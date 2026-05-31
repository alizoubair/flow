"""
Progress notification tool — pushes real-time status updates
to the client via WebSocket (API Gateway Management API).
"""
import json
import logging
import boto3
from strands import tool

logger = logging.getLogger(__name__)


def build_progress_tool(connection_id: str, ws_endpoint: str, region: str):
    """
    Build a progress notification tool bound to a specific WebSocket connection.

    Args:
        connection_id: WebSocket connection ID to push updates to
        ws_endpoint: API Gateway Management API endpoint URL
        region: AWS region
    """
    if not ws_endpoint or not connection_id:
        @tool
        def notify_progress(agent_name: str, status: str, detail: str = '') -> str:
            """Send a progress update to the client. No-op: WebSocket not configured."""
            logger.warning(f'Progress (no WS): {agent_name} -> {status}: {detail}')
            return 'ok'
        return notify_progress

    apigw = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=ws_endpoint,
        region_name=region,
    )

    @tool
    def notify_progress(agent_name: str, status: str, detail: str = '') -> str:
        """
        Send a progress update to the client via WebSocket.
        Call this BEFORE and AFTER each agent step to keep the user informed.

        Args:
            agent_name: Name of the agent step. Must be one of:
                repo_analysis, pipeline_intelligence, validation, optimizer, export
            status: One of: start, complete, failed
            detail: Short description of what happened or is happening

        Returns:
            'ok' if sent successfully
        """
        message_type = f'agent_{status}'

        message = {
            'type': message_type,
            'agent': agent_name,
            'detail': detail,
        }

        try:
            apigw.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(message).encode('utf-8'),
            )
            logger.info(f'Progress sent: {agent_name} -> {status}')
        except Exception as e:
            logger.warning(f'Failed to send progress: {e}')

        return 'ok'

    return notify_progress
