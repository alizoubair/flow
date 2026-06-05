"""
Delete conversation handler.

Removes a single conversation record from the user's history.

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
    """Delete a single conversation for the authenticated user."""
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
        table.delete_item(Key={'userId': user_id, 'createdAt': created_at})

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'deleted': created_at}),
        }

    except Exception as e:
        print(f'Error deleting conversation: {e}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to delete conversation'}),
        }
