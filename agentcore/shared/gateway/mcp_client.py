"""MCP client for AgentCore Gateway tools."""
import logging
import os
from typing import Any, Callable, Optional

import httpx
from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp import MCPClient

from shared.gateway.auth import get_gateway_bearer_token

logger = logging.getLogger(__name__)


class BearerAuth(httpx.Auth):
    def __init__(self, token: str):
        self.token = token

    def auth_flow(self, request: httpx.Request):
        request.headers["Authorization"] = f"Bearer {self.token}"
        yield request


class GatewayMCPClient(MCPClient):
    """MCP client that exposes Gateway tools under their short schema names."""

    def __init__(self, client_factory: Callable[[], Any]):
        super().__init__(client_factory)
        self._tool_name_map: dict[str, str] = {}

    def list_tools_sync(self, *args, **kwargs):
        from strands.types import PaginatedList

        paginated = super().list_tools_sync(*args, **kwargs)
        simplified = []
        self._tool_name_map = {}

        for tool in paginated:
            full_name = tool.tool_name
            short_name = full_name.split("___")[-1] if "___" in full_name else full_name
            self._tool_name_map[short_name] = full_name
            tool._agent_tool_name = short_name
            simplified.append(tool)

        logger.info("Loaded %d Gateway MCP tools", len(simplified))
        return PaginatedList(simplified, token=paginated.pagination_token)

    def call_tool_sync(self, tool_use_id: str, name: str, arguments: dict, **kwargs):
        actual_name = self._tool_name_map.get(name, name)
        return super().call_tool_sync(tool_use_id, actual_name, arguments, **kwargs)


def create_gateway_mcp_client() -> Optional[GatewayMCPClient]:
    gateway_url = os.environ.get("GATEWAY_MCP_URL", "")
    if not gateway_url:
        logger.warning("GATEWAY_MCP_URL is not configured")
        return None

    token = get_gateway_bearer_token()
    auth = BearerAuth(token)

    return GatewayMCPClient(
        lambda: streamablehttp_client(gateway_url, auth=auth),
    )
