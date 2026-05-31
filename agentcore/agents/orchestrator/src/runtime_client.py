"""
Runtime client — invokes sub-agents via bedrock-agentcore InvokeAgentRuntime.

Uses boto3 to call sub-agents deployed on AgentCore Runtime.
"""
import os
import json
import uuid
import logging
import boto3

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')

_client = boto3.client('bedrock-agentcore', region_name=AWS_REGION)


def call_agent(runtime_arn: str, task: dict, user_id: str, session_id: str) -> dict:
    """
    Invoke a sub-agent via AgentCore InvokeAgentRuntime.

    Args:
        runtime_arn: ARN of the target agent runtime
        task: Task payload dict (e.g. {'repo_url': '...', 'provider': 'github'})
        user_id: Cognito sub of the requesting user
        session_id: Current session ID

    Returns:
        Agent response as a dict (parsed JSON) or {'text': '...'} for plain text
    """
    if not runtime_arn:
        raise ValueError('Agent runtime ARN is not configured')

    payload = {
        'task': task,
        'metadata': {
            'userId': user_id,
            'sessionId': session_id,
            'requestId': str(uuid.uuid4()),
        },
    }

    try:
        response = _client.invoke_agent_runtime(
            agentRuntimeArn=runtime_arn,
            runtimeSessionId=session_id,
            runtimeUserId=user_id,
            payload=json.dumps(payload).encode('utf-8'),
        )

        # Read the response
        response_body = response.get('body', response.get('payload', b''))
        if hasattr(response_body, 'read'):
            response_body = response_body.read()
        if isinstance(response_body, bytes):
            response_body = response_body.decode('utf-8')

        # Try to parse as JSON
        try:
            return json.loads(response_body)
        except (json.JSONDecodeError, TypeError):
            return {'text': response_body}

    except Exception as e:
        logger.error(f'Error invoking agent {runtime_arn}: {e}')
        raise RuntimeError(f'Agent invocation failed: {str(e)}')
