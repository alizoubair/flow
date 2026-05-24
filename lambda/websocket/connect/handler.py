"""
WebSocket $connect handler.

Fires when a client opens a WebSocket connection.
Stores the connectionId + userId in the connections DynamoDB table
so agents can later push updates to this client.

Query string parameters expected:
  ?token=<cognito-id-token>   (optional — used to associate userId)
"""
import os
import json
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE', 'flow-ws-connections')


def _get_user_id(event):
    """
    Extract userId from Cognito authorizer claims injected by API Gateway.
    Falls back to 'anonymous' if no authorizer is configured.
    """
    try:
        return event['requestContext']['authorizer']['claims']['sub']
    except (KeyError, TypeError):
        return 'anonymous'


def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    user_id = _get_user_id(event)

    table = dynamodb.Table(CONNECTIONS_TABLE)

    try:
        table.put_item(
            Item={
                'connectionId': connection_id,
                'userId': user_id,
                'connectedAt': datetime.now(timezone.utc).isoformat(),
                # TTL: auto-expire connections after 2 hours (7200 seconds)
                'ttl': int(datetime.now(timezone.utc).timestamp()) + 7200,
            }
        )
        print(f'Connected: {connection_id} (user: {user_id})')
        return {'statusCode': 200, 'body': 'Connected'}

    except ClientError as e:
        print(f'Error storing connection: {e}')
        return {'statusCode': 500, 'body': 'Failed to connect'}
