"""
Lambda function to trigger a CI pipeline run.
POST /pipelines/{id}/run

Generates a run_id, finds the user's active WebSocket connection for
progress streaming, and async-invokes the CI orchestrator Lambda.
Returns 202 { run_id } immediately — progress arrives via WebSocket.
"""
import json
import os
import sys
import boto3
from uuid import uuid4

sys.path.append('/opt/python')
from db_utils import get_user_id, table, build_response, build_error_response
from validators import validate_pipeline_id

AWS_REGION               = os.environ.get('AWS_REGION', 'us-west-2')
CI_ORCHESTRATOR_FUNCTION = os.environ.get('CI_ORCHESTRATOR_FUNCTION', '')
CONNECTIONS_TABLE        = os.environ.get('CONNECTIONS_TABLE', '')

lambda_client = boto3.client('lambda', region_name=AWS_REGION)
dynamodb      = boto3.resource('dynamodb', region_name=AWS_REGION)


def _get_connection_id(user_id: str) -> str:
    """Return the user's most recent active WebSocket connection ID, or ''."""
    resp = dynamodb.Table(CONNECTIONS_TABLE).query(
        IndexName='UserIdIndex',
        KeyConditionExpression='userId = :uid',
        ExpressionAttributeValues={':uid': user_id},
        Limit=1,
    )
    items = resp.get('Items', [])
    return items[0]['connectionId'] if items else ''


def lambda_handler(event, context):
    try:
        pipeline_id = event['pathParameters']['id']

        is_valid, error_msg = validate_pipeline_id(pipeline_id)
        if not is_valid:
            return build_error_response(400, error_msg)

        user_id = get_user_id(event)

        existing = table.get_item(
            Key={'PK': f"USER#{user_id}", 'SK': f"PIPELINE#{pipeline_id}"}
        )
        if 'Item' not in existing:
            return build_error_response(404, 'Pipeline not found')

        run_id        = str(uuid4())
        connection_id = _get_connection_id(user_id)

        pipeline_item = existing['Item']
        runner_stages = pipeline_item.get('runner_stages') or []
        print(f'[pipeline-run] run={run_id} pipeline={pipeline_id} user={user_id} runner_stages={len(runner_stages)} connection={connection_id[:12] if connection_id else "none"}')

        lambda_client.invoke(
            FunctionName=CI_ORCHESTRATOR_FUNCTION,
            InvocationType='Event',
            Qualifier='$LATEST',
            Payload=json.dumps({
                'run_id':        run_id,
                'pipeline_id':   pipeline_id,
                'user_id':       user_id,
                'connection_id': connection_id,
            }).encode(),
        )

        print(f'[pipeline-run] started run={run_id} pipeline={pipeline_id} user={user_id}')
        return build_response(202, {'run_id': run_id, 'status': 'accepted'})

    except KeyError:
        return build_error_response(400, 'Pipeline ID is required')
    except Exception as e:
        print(f'[pipeline-run] error: {e}')
        return build_error_response(500, 'Internal server error')
