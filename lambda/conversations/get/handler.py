"""
Get conversation handler.

Returns a single conversation record (including the full, untruncated
response) so the frontend can reopen the generated pipeline on the canvas.

Path params:
  /conversations/{id}   where id is the createdAt timestamp (sort key)
"""
import os
import json
import boto3

region = os.environ.get('FLOW_AWS_REGION', os.environ.get('AWS_REGION', 'us-west-2'))
dynamodb = boto3.resource('dynamodb', region_name=region)
CONVERSATIONS_TABLE = os.environ.get('CONVERSATIONS_TABLE', 'flow-conversations')


def lambda_handler(event, context):
    """Return a single conversation for the authenticated user."""
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    except (KeyError, TypeError):
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Unauthorized'}),
        }

    created_at = (event.get('pathParameters') or {}).get('id')
    if not created_at:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'id is required'}),
        }

    table = dynamodb.Table(CONVERSATIONS_TABLE)

    try:
        response = table.get_item(Key={'userId': user_id, 'createdAt': created_at})
        item = response.get('Item')

        if not item:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Conversation not found'}),
            }

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'createdAt': item['createdAt'],
                'prompt': item.get('prompt', ''),
                'response': item.get('response', ''),
                'action': item.get('action', ''),
            }),
        }

    except Exception as e:
        print(f'Error getting conversation: {e}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to get conversation'}),
        }
