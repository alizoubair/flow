"""Fetch a Cognito bearer token for AgentCore Gateway (client credentials)."""
import base64
import json
import logging
import os
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

_TOKEN_CACHE: str | None = None


def get_gateway_bearer_token() -> str:
    """Return a Cognito access token for MCP Gateway inbound auth."""
    global _TOKEN_CACHE
    if _TOKEN_CACHE:
        return _TOKEN_CACHE

    secret_arn = os.environ.get("GATEWAY_AUTH_SECRET_ARN", "")
    token_url = os.environ.get("COGNITO_TOKEN_URL", "")
    if not secret_arn or not token_url:
        raise RuntimeError("GATEWAY_AUTH_SECRET_ARN and COGNITO_TOKEN_URL must be configured")

    import boto3

    raw = boto3.client("secretsmanager").get_secret_value(SecretId=secret_arn)["SecretString"]
    creds = json.loads(raw)
    client_id = creds.get("client_id", "")
    client_secret = creds.get("client_secret", "")
    scope = creds.get("scope", "")
    if not client_id or not client_secret:
        raise RuntimeError("Gateway auth secret must contain client_id and client_secret")

    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    body = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "scope": scope,
    }).encode()

    req = urllib.request.Request(
        token_url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        token_response = json.loads(resp.read().decode())

    access_token = token_response.get("access_token", "")
    if not access_token:
        raise RuntimeError("Cognito token response did not include access_token")

    _TOKEN_CACHE = access_token
    logger.info("Obtained Cognito bearer token for MCP Gateway")
    return access_token
