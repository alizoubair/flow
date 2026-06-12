"""
Source-control tool Lambda for AgentCore Gateway (GitHub).

Exposes repository-inspection tools (repo metadata, file tree, file content,
existence checks) as MCP tools over the Gateway.

Design notes:
- Standard library only (urllib + json + base64) so the Gateway tool Lambda
  can be packaged with a plain archive_file zip — no pip build step.
- GitHub token is read once (cold start) from Secrets Manager via
  GIT_PROVIDER_SECRET_ARN. Secret JSON: {"github_token": "..."}.
- AgentCore Gateway unwraps tool arguments into `event` and reads the invoked
  tool name from context.client_context.custom['bedrockAgentCoreToolName'].
"""
import os
import json
import base64
import logging
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

GITHUB_API = "https://api.github.com"
MAX_FILE_CHARS = 5000

_GITHUB_TOKEN: str | None = None

_TOOL_HANDLERS = {}


def _load_github_token() -> str:
    global _GITHUB_TOKEN
    if _GITHUB_TOKEN is not None:
        return _GITHUB_TOKEN

    token = ""
    secret_arn = os.environ.get("GIT_PROVIDER_SECRET_ARN", "")
    if secret_arn:
        try:
            import boto3  # provided by the Lambda runtime

            client = boto3.client("secretsmanager")
            raw = client.get_secret_value(SecretId=secret_arn).get("SecretString", "{}")
            token = json.loads(raw).get("github_token", "")
        except Exception as e:  # noqa: BLE001 - degrade to unauthenticated calls
            logger.warning("Could not load GitHub token: %s", e)

    _GITHUB_TOKEN = token
    return token


def _parse_owner_repo(repo_url: str) -> tuple[str, str]:
    parts = repo_url.rstrip("/").split("/")
    if len(parts) >= 2:
        return parts[-2], parts[-1].replace(".git", "")
    raise ValueError(f"Cannot parse GitHub repository URL: {repo_url}")


def _github_headers() -> dict:
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "flow-source-control"}
    token = _load_github_token()
    if token:
        headers["Authorization"] = f"token {token}"
    return headers


def _http_get(url: str, headers: dict, timeout: int = 10) -> tuple[int, dict | list | None]:
    req = Request(url, headers=headers, method="GET")
    try:
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, (json.loads(body) if body else None)
    except HTTPError as e:
        return e.code, None
    except URLError as e:
        logger.warning("Request failed for %s: %s", url, e)
        return 0, None


def get_repo_info(repo_url: str) -> dict:
    owner, repo = _parse_owner_repo(repo_url)
    status, data = _http_get(f"{GITHUB_API}/repos/{owner}/{repo}", _github_headers())
    if status != 200 or not isinstance(data, dict):
        return _error(f"GitHub repo lookup failed (status {status})")
    return {
        "name": data.get("name"),
        "description": data.get("description", ""),
        "language": data.get("language", "Unknown"),
        "default_branch": data.get("default_branch", "main"),
        "topics": data.get("topics", []),
        "size_kb": data.get("size", 0),
    }


def get_file_tree(repo_url: str, path: str = "") -> list | dict:
    owner, repo = _parse_owner_repo(repo_url)
    status, data = _http_get(f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}", _github_headers())
    if status != 200:
        return _error(f"GitHub tree lookup failed (status {status})")
    if not isinstance(data, list):
        return [{"name": data.get("name"), "type": data.get("type")}] if isinstance(data, dict) else []
    return [{"name": item["name"], "type": item["type"]} for item in data]


def read_file_content(repo_url: str, file_path: str) -> str | dict:
    owner, repo = _parse_owner_repo(repo_url)
    status, data = _http_get(
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{file_path}",
        _github_headers(),
    )
    if status != 200 or not isinstance(data, dict):
        return _error(f"GitHub file read failed (status {status})")
    if data.get("encoding") == "base64":
        content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    else:
        content = data.get("content", "")
    return _truncate(content)


def check_files_exist(repo_url: str, file_paths: list) -> dict:
    owner, repo = _parse_owner_repo(repo_url)
    results = {}
    for path in file_paths:
        status, _ = _http_get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
            _github_headers(),
            timeout=5,
        )
        results[path] = status == 200
    return results


_TOOL_HANDLERS.update({
    "get_repo_info": lambda event: get_repo_info(event["repo_url"]),
    "get_file_tree": lambda event: get_file_tree(event["repo_url"], event.get("path", "")),
    "read_file_content": lambda event: read_file_content(event["repo_url"], event["file_path"]),
    "check_files_exist": lambda event: check_files_exist(event["repo_url"], event.get("file_paths", [])),
})


def _resolve_tool_name(context) -> str:
    name = ""
    if context is not None and getattr(context, "client_context", None):
        custom = getattr(context.client_context, "custom", None)
        if custom:
            name = custom.get("bedrockAgentCoreToolName", "")
    return name.split("___")[-1] if "___" in name else name


def lambda_handler(event, context):
    logger.info("Event: %s", json.dumps(event) if isinstance(event, dict) else str(event))
    tool_name = _resolve_tool_name(context)
    if not tool_name:
        return _error("Could not resolve tool name from Gateway context")

    if not isinstance(event, dict) or "repo_url" not in event:
        return _error("repo_url is required")

    handler = _TOOL_HANDLERS.get(tool_name)
    if handler is None:
        return _error(f"Unknown tool: {tool_name}")

    try:
        return handler(event)
    except KeyError as e:
        return _error(f"Missing required argument: {e}")
    except Exception as e:  # noqa: BLE001
        logger.error("Tool %s failed: %s", tool_name, e, exc_info=True)
        return _error(str(e))


def _truncate(content: str) -> str:
    if len(content) > MAX_FILE_CHARS:
        return content[:MAX_FILE_CHARS] + "\n... (truncated)"
    return content


def _error(message: str) -> dict:
    return {"error": message}
