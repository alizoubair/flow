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
import base64
from datetime import datetime, timezone
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('FLOW_AWS_REGION', os.environ.get('AWS_REGION', 'us-west-2')))
CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE', 'flow-ws-connections')


def _decode_jwt_payload(token):
    """
    Decode JWT payload without verification (basic extraction).
    For production, use proper JWT verification with Cognito public keys.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        # Decode payload (second part)
        payload = parts[1]
        # Add padding if needed
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding

        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception as e:
        print(f'Error decoding JWT: {e}')
        return None


def _get_user_id(event):
    """
    Extract userId from Cognito token in query string or from authorizer claims.
    Falls back to 'anonymous' if no token is provided.
    """
    # Try authorizer claims first (if authorizer is configured)
    try:
        return event['requestContext']['authorizer']['claims']['sub']
    except (KeyError, TypeError):
        pass

    # Try to extract from query string token
    try:
        query_params = event.get('queryStringParameters') or {}
        token = query_params.get('token')

        if token:
            payload = _decode_jwt_payload(token)
            if payload and 'sub' in payload:
                print(f"Authenticated user from token: {payload.get('email', payload['sub'])}")
                return payload['sub']
    except Exception as e:
        print(f'Error extracting user from token: {e}')

    return 'anonymous'


def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    user_id = _get_user_id(event)

    # Get JWT token from query string
    query_params = event.get('queryStringParameters') or {}
    token = query_params.get('token', '')

    table = dynamodb.Table(CONNECTIONS_TABLE)

    try:
        table.put_item(
            Item={
                'connectionId': connection_id,
                'userId': user_id,
                'token': token,  # Store JWT token for runtime invocation
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
