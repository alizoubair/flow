"""Shared AgentCore Gateway MCP client for agent runtimes."""

from shared.gateway.auth import get_gateway_bearer_token
from shared.gateway.mcp_client import GatewayMCPClient, create_gateway_mcp_client

__all__ = [
    "GatewayMCPClient",
    "create_gateway_mcp_client",
    "get_gateway_bearer_token",
]
