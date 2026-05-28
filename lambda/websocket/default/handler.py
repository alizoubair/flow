"""
WebSocket $default route handler.

Handles messages sent from the client over the WebSocket connection.

Expected message format (JSON):
{
  "action": "ping" | "message",
  "payload": { ... }
}
"""
import os
import json
import boto3
from botocore.exceptions import ClientError

region = os.environ.get('FLOW_AWS_REGION', os.environ.get('AWS_REGION', 'us-west-2'))
dynamodb = boto3.resource('dynamodb', region_name=region)

CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE', 'flow-ws-connections')
WS_ENDPOINT = os.environ.get('WS_ENDPOINT', '')


def _get_apigw_client():
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
        # Stale connection — clean it up
        table = dynamodb.Table(CONNECTIONS_TABLE)
        table.delete_item(Key={'connectionId': connection_id})


def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']

    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        _send_message(connection_id, {
            'type': 'error',
            'message': 'Invalid JSON message'
        })
        return {'statusCode': 400, 'body': 'Invalid JSON'}

    action = body.get('action', '')

    # ping
    if action == 'ping':
        _send_message(connection_id, {'type': 'pong'})
        return {'statusCode': 200, 'body': 'pong'}

    # echo back any other message
    _send_message(connection_id, {
        'type': 'echo',
        'action': action,
        'payload': body.get('payload', {})
    })
    return {'statusCode': 200, 'body': 'ok'}
