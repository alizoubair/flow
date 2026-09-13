"""Ephemeral CI stage runner for the Flow pipeline.

Runs inside a Lambda MicroVM. HTTP server on port 9000:
  POST /run    - accepts a stage job, returns 202 immediately, executes
                 steps on a background thread
  GET  /health - health check
  ANY  else    - 200 OK (MicroVM lifecycle hooks)

Background thread flow:
  1. Download prev-stage artifacts from S3 (if artifact_key is set)
  2. Execute each step from stage["steps"] sequentially
  3. Stream step output to the client's WebSocket connection
  4. Upload workspace artifacts to S3
  5. Signal durable orchestrator via SendDurableExecutionCallbackSuccess
     (or Failure on any non-zero exit code)
"""

import json
import logging
import os
import shutil
import subprocess
import tarfile
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

import boto3

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PORT = 9000
# Defaults from env vars (set at image build time); overridden per-job from POST body
REGION              = os.environ.get("AWS_REGION", "us-west-2")
CI_ARTIFACTS_BUCKET = os.environ.get("CI_ARTIFACTS_BUCKET", "")
GIT_SECRET_ARN      = os.environ.get("GIT_PROVIDER_SECRET_ARN", "")

REQUIRED = ["run_id", "stages", "callback_id", "connection_id", "ws_endpoint"]


def _lambda():
    return boto3.client("lambda", region_name=REGION)

def _s3():
    return boto3.client("s3", region_name=REGION)

def _apigw(ws_endpoint: str):
    return boto3.client("apigatewaymanagementapi", endpoint_url=ws_endpoint, region_name=REGION)


def _github_token(region: str = REGION, secret_arn: str = GIT_SECRET_ARN) -> str:
    secret = boto3.client("secretsmanager", region_name=region).get_secret_value(
        SecretId=secret_arn
    )
    return json.loads(secret["SecretString"])["github_token"]


def _ws_send(ws_endpoint: str, connection_id: str, message: dict) -> None:
    if not ws_endpoint or not connection_id:
        return
    try:
        _apigw(ws_endpoint).post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message).encode(),
        )
    except Exception as e:
        logger.warning("WebSocket send failed: %s", e)


def _download_artifacts(artifact_key: str, dest: str) -> None:
    local = os.path.join(dest, "artifacts.tar.gz")
    _s3().download_file(CI_ARTIFACTS_BUCKET, artifact_key, local)
    with tarfile.open(local, "r:gz") as t:
        t.extractall(dest)
    os.remove(local)
    logger.info("downloaded artifacts from s3://%s/%s", CI_ARTIFACTS_BUCKET, artifact_key)


def _upload_artifacts(run_id: str, stage_name: str, src: str) -> str:
    archive = os.path.join(tempfile.mkdtemp(), "artifacts.tar.gz")
    with tarfile.open(archive, "w:gz") as t:
        t.add(src, arcname=".")
    key = f"runs/{run_id}/{stage_name}/artifacts.tar.gz"
    _s3().upload_file(archive, CI_ARTIFACTS_BUCKET, key)
    os.remove(archive)
    logger.info("uploaded artifacts to s3://%s/%s", CI_ARTIFACTS_BUCKET, key)
    return key


def _clone_repo(repo_url: str, work: str, region: str = REGION, secret_arn: str = GIT_SECRET_ARN) -> None:
    token = _github_token(region=region, secret_arn=secret_arn)
    # Inject token into HTTPS URL: https://<token>@github.com/owner/repo.git
    authenticated = repo_url.replace("https://", f"https://{token}@")
    subprocess.run(
        ["git", "clone", "--depth", "1", authenticated, work],
        check=True, capture_output=True, text=True, timeout=120,
    )
    logger.info("cloned %s", repo_url)


def run_pipeline(job: dict) -> None:
    """Run all stages sequentially in one shared workspace. One MicroVM, one clone."""
    run_id        = job["run_id"]
    stages        = job["stages"]           # ALL pipeline stages
    repo_url      = job.get("repo_url", "")
    connection_id = job.get("connection_id", "")
    ws_endpoint   = job.get("ws_endpoint", "")
    callback_id   = job["callback_id"]

    region           = job.get("aws_region", REGION)
    git_secret       = job.get("git_secret_arn", GIT_SECRET_ARN)

    work = tempfile.mkdtemp(prefix="ci-")
    try:
        # Clone the repo ONCE — all stages share the same workspace
        if repo_url:
            _clone_repo(repo_url, work, region=region, secret_arn=git_secret)

        # Run all stages sequentially
        for stage in stages:
            _ws_send(ws_endpoint, connection_id, {
                "type":   "stage_start",
                "run_id": run_id,
                "stage":  stage["name"],
            })

            for step in stage.get("steps", []):
                step_name = step.get("name", step["run"][:40])
                logger.info("stage=%s step=%s", stage["name"], step_name)

                _ws_send(ws_endpoint, connection_id, {
                    "type":   "step_start",
                    "run_id": run_id,
                    "stage":  stage["name"],
                    "step":   step_name,
                })

                proc = subprocess.run(
                    step["run"],
                    shell=True,
                    cwd=work,
                    capture_output=True,
                    text=True,
                    timeout=3600,
                )
                output = (proc.stdout + proc.stderr)[-4000:]

                _ws_send(ws_endpoint, connection_id, {
                    "type":      "step_output",
                    "run_id":    run_id,
                    "stage":     stage["name"],
                    "step":      step_name,
                    "output":    output,
                    "exit_code": proc.returncode,
                })

                if proc.returncode != 0:
                    _lambda().send_durable_execution_callback_failure(
                        CallbackId=callback_id,
                        Error={"ErrorType": "StepFailed", "ErrorMessage": f"Stage '{stage['name']}' step '{step_name}' exited {proc.returncode}\n{output[-1000:]}"},
                    )
                    return

            _ws_send(ws_endpoint, connection_id, {
                "type":   "stage_complete",
                "run_id": run_id,
                "stage":  stage["name"],
            })
            logger.info("stage %s complete run=%s", stage["name"], run_id)

        # All stages passed
        _lambda().send_durable_execution_callback_success(
            CallbackId=callback_id,
            Result=json.dumps({"status": "completed", "run_id": run_id}),
        )
        logger.info("pipeline complete run=%s", run_id)

    except subprocess.TimeoutExpired as e:
        _lambda().send_durable_execution_callback_failure(
            CallbackId=callback_id,
            Error={"ErrorType": "StepTimeout", "ErrorMessage": str(e)},
        )
    except Exception as e:
        logger.error("pipeline execution error: %r", e)
        _lambda().send_durable_execution_callback_failure(
            CallbackId=callback_id,
            Error={"ErrorType": "ExecutionError", "ErrorMessage": repr(e)},
        )
    finally:
        shutil.rmtree(work, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        logger.info("HTTP %s %s", self.address_string(), fmt % args)

    def _json(self, status: int, body: dict) -> None:
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        self._json(200, {"status": "ok"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""

        if self.path == "/run":
            try:
                job = json.loads(raw or b"{}")
            except Exception as e:
                self._json(400, {"error": f"invalid JSON: {e}"})
                return
            missing = [f for f in REQUIRED if f not in job]
            if missing:
                self._json(400, {"error": f"missing fields: {missing}"})
                return

            # 202 first, then execute stage on a background thread
            self._json(202, {"status": "accepted"})
            threading.Thread(target=run_pipeline, args=(job,), daemon=True).start()
            return

        # Any other POST — MicroVM lifecycle hooks
        self._json(200, {"status": "ok"})


class ThreadedHTTP(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    server = ThreadedHTTP(("0.0.0.0", PORT), Handler)
    logger.info("CI runner listening on 0.0.0.0:%d", PORT)
    server.serve_forever()


if __name__ == "__main__":
    main()
