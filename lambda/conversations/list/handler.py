"""
List conversations handler.

Returns the user's conversation history from DynamoDB,
sorted by most recent first.

Query params:
  ?limit=20  (default 20, max 50)
"""
import os
import json
import boto3
from boto3.dynamodb.conditions import Key

region = os.environ.get('FLOW_AWS_REGION', os.environ.get('AWS_REGION', 'us-west-2'))
dynamodb = boto3.resource('dynamodb', region_name=region)
CONVERSATIONS_TABLE = os.environ.get('CONVERSATIONS_TABLE', 'flow-conversations')


def lambda_handler(event, context):
    """List conversations for the authenticated user."""
    # Get user ID from Cognito JWT claims
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    except (KeyError, TypeError):
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Unauthorized'}),
        }

    # Parse limit from query params
    params = event.get('queryStringParameters') or {}
    limit = min(int(params.get('limit', '20')), 50)

    table = dynamodb.Table(CONVERSATIONS_TABLE)

    try:
        response = table.query(
            KeyConditionExpression=Key('userId').eq(user_id),
            ScanIndexForward=False,  # Most recent first
            Limit=limit,
        )

        conversations = [{
            'createdAt': item['createdAt'],
            'prompt': item.get('prompt', ''),
            'response': item.get('response', '')[:500],  # Truncate for list view
            'action': item.get('action', ''),
        } for item in response.get('Items', [])]

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'conversations': conversations,
                'count': len(conversations),
            }),
        }

    except Exception as e:
        print(f'Error listing conversations: {e}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to list conversations'}),
        }
