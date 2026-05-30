"""
WebSocket orchestrator handler.

Handles pipeline orchestration commands from the client.
Invokes the AgentCore runtime via bedrock-agentcore API.

Expected message format:
{
  "action": "orchestrator",
  "operation": "execute_pipeline",
  "payload": { "prompt": "...", "generate": true }
}
"""
import os
import json
import boto3
from botocore.exceptions import ClientError


# AWS clients
region = os.environ.get('FLOW_AWS_REGION', os.environ.get('AWS_REGION', 'us-west-2'))
dynamodb = boto3.resource('dynamodb', region_name=region)
agent_core_client = boto3.client('bedrock-agentcore', region_name=region)

# Environment variables
ORCHESTRATOR_RUNTIME_ID = os.environ.get('ORCHESTRATOR_RUNTIME_ID')
ORCHESTRATOR_RUNTIME_ARN = os.environ.get('ORCHESTRATOR_RUNTIME_ARN')
CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE', 'flow-ws-connections')
WS_ENDPOINT = os.environ.get('WS_ENDPOINT', '')


def _get_apigw_client():
    """Get API Gateway Management API client for WebSocket."""
    return boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=WS_ENDPOINT,
        region_name=region
    )


def _send_message(connection_id, message):
    """Push a JSON message to a specific WebSocket connection."""
    apigw = _get_apigw_client()
    try:
        apigw.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message).encode('utf-8')
        )
    except apigw.exceptions.GoneException:
        table = dynamodb.Table(CONNECTIONS_TABLE)
        table.delete_item(Key={'connectionId': connection_id})
    except ClientError as e:
        print(f'Error sending message to {connection_id}: {e}')


def _invoke_orchestrator(connection_id, action, payload):
    """Invoke the AgentCore runtime with OAuth token."""
    if not ORCHESTRATOR_RUNTIME_ARN:
        _send_message(connection_id, {
            'type': 'error',
            'message': 'Orchestrator runtime not configured'
        })
        return

    # Get user's JWT token and user_id from DynamoDB
    table = dynamodb.Table(CONNECTIONS_TABLE)
    conn_item = table.get_item(Key={'connectionId': connection_id})
    item = conn_item.get('Item', {})
    user_token = item.get('token', '')
    user_id = item.get('userId', 'anonymous')

    if not user_token:
        _send_message(connection_id, {
            'type': 'error',
            'message': 'No authentication token found. Please reconnect.'
        })
        return

    # Use user_id as the stable session ID so AgentCore memory persists
    # across reconnects and multiple WebSocket connections for the same user.
    # Fall back to connection_id for anonymous users.
    session_id = user_id if user_id != 'anonymous' else connection_id

    runtime_input = {
        'action': action,
        'prompt': payload.get('prompt', ''),
        'connectionId': connection_id,
        'wsEndpoint': WS_ENDPOINT,
        **payload
    }

    print(f'Invoking runtime {ORCHESTRATOR_RUNTIME_ID}, action: {action}, session: {session_id}')

    _send_message(connection_id, {
        'type': 'orchestrator_invoked',
        'action': action
    })

    try:
        response = agent_core_client.invoke_agent_runtime(
            agentRuntimeArn=ORCHESTRATOR_RUNTIME_ARN,
            runtimeSessionId=session_id,
            runtimeUserId=user_id,
            payload=json.dumps(runtime_input).encode('utf-8'),
        )

        # Read the streaming response
        response_body = response['response'].read().decode('utf-8')
        print(f'Runtime response: {response_body[:500]}')

        _send_message(connection_id, {
            'type': 'orchestrator_complete',
            'action': action,
            'result': response_body
        })

    except Exception as e:
        import traceback
        print(f'Error invoking orchestrator: {e}')
        print(f'Traceback: {traceback.format_exc()}')
        _send_message(connection_id, {
            'type': 'error',
            'message': f'Failed to invoke orchestrator: {str(e)}'
        })


def lambda_handler(event, context):
    """Handle WebSocket orchestrator messages."""
    connection_id = event['requestContext']['connectionId']

    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        _send_message(connection_id, {
            'type': 'error',
            'message': 'Invalid JSON message'
        })
        return {'statusCode': 400, 'body': 'Invalid JSON'}

    operation = body.get('operation', body.get('action', ''))
    payload = body.get('payload', {})

    print(f'Received - operation: {operation}, payload keys: {list(payload.keys())}')

    pipeline_id = body.get('pipeline_id')
    if pipeline_id:
        payload['pipeline_id'] = pipeline_id

    valid_operations = ['execute_pipeline', 'get_status', 'cancel_pipeline', 'list_pipelines']
    if operation not in valid_operations:
        _send_message(connection_id, {
            'type': 'error',
            'message': f'Invalid operation: {operation}. Valid: {", ".join(valid_operations)}'
        })
        return {'statusCode': 400, 'body': 'Invalid operation'}

    _invoke_orchestrator(connection_id, operation, payload)

    return {'statusCode': 200, 'body': 'OK'}
