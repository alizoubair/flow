"""
Orchestrator AgentCore Runtime entrypoint.

Deployed to Amazon Bedrock AgentCore Runtime. The runtime exposes
this as an HTTP service with /invocations POST and /ping GET endpoints.

Expected invocation payload:
{
    "prompt": "Create a pipeline for my Node.js app",
    "session_id": "<session-id>",
    "user_id": "<cognito-sub>"
}
"""
import os
import logging
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from .agent import build_orchestrator

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

app = BedrockAgentCoreApp()


@app.entrypoint
def handler(payload: dict, context) -> str:
    """
    AgentCore Runtime entrypoint.

    Args:
        payload: Request payload from the caller
        context: RequestContext object (session_id, user_id, etc.)

    Returns:
        Agent response as a string
    """
    prompt = payload.get('prompt', '')

    # Prefer user_id from context (set via runtimeUserId header), fall back to payload
    user_id = getattr(context, 'user_id', None) or payload.get('user_id', 'anonymous')

    # Use AgentCore session ID from context if available, else from payload
    session_id = getattr(context, 'session_id', None) or payload.get('session_id', user_id)

    if not prompt:
        return 'Please provide a prompt.'

    logger.info(f'Orchestrator invoked: user={user_id} session={session_id}')
    logger.info(f'Prompt preview: {prompt[:200]}')

    # WebSocket connection info for streaming progress updates to the client
    connection_id = payload.get('connectionId', '')
    ws_endpoint = payload.get('wsEndpoint', '')

    orchestrator = build_orchestrator(
        user_id=user_id,
        session_id=session_id,
        connection_id=connection_id,
        ws_endpoint=ws_endpoint,
    )

    result = orchestrator(prompt)
    response = str(result)
    logger.info(f'Orchestrator response length: {len(response)}')
    logger.info(f'Response preview: {response[:300]}')
    return response


if __name__ == '__main__':
    app.run()
