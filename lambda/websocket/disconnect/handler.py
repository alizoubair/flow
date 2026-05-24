"""
WebSocket $disconnect handler.

Fires when a client closes the WebSocket connection (or it times out).
Removes the connectionId from the connections table.
"""
import os
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE', 'flow-ws-connections')


def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    table = dynamodb.Table(CONNECTIONS_TABLE)

    try:
        table.delete_item(Key={'connectionId': connection_id})
        print(f'Disconnected: {connection_id}')
        return {'statusCode': 200, 'body': 'Disconnected'}

    except ClientError as e:
        print(f'Error removing connection: {e}')
        # Return 200 anyway — a failed cleanup should not block the disconnect
        return {'statusCode': 200, 'body': 'Disconnected'}
