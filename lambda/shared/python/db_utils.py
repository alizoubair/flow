"""
Shared database utilities for Pipeline Lambdas
"""
import boto3
import os
from decimal import Decimal
import json

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')
PIPELINES_TABLE = os.environ.get('PIPELINES_TABLE', 'flow-pipelines')
table = dynamodb.Table(PIPELINES_TABLE)


class DecimalEncoder(json.JSONEncoder):
    """Helper class to convert Decimal to int/float for JSON serialization"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)


def get_user_id(event):
    """
    Extract user ID (sub) from Cognito JWT claims injected by API Gateway
    Cognito User Pool Authorizer puts claims under:
      event['requestContext']['authorizer']['claims']
    """
    try:
        claims = event['requestContext']['authorizer']['claims']
        return claims['sub']
    except (KeyError, TypeError):
        # Fallback for local testing without a real authorizer
        return event.get('requestContext', {}).get('authorizer', {}).get('principalId', 'demo-user')


def build_response(status_code, body):
    """Build API Gateway response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': True,
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }


def build_error_response(status_code, message):
    """Build error response"""
    return build_response(status_code, {'error': message})
