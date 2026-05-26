"""
Lambda function to update a pipeline
PUT /pipelines/{id}
"""
import json
import sys
from datetime import datetime

sys.path.append('/opt/python')
from db_utils import table, get_user_id, build_response, build_error_response
from validators import validate_pipeline_id, validate_pipeline_data


def lambda_handler(event, context):
    try:
        pipeline_id = event['pathParameters']['id']
        body = json.loads(event.get('body', '{}'))

        is_valid, error_msg = validate_pipeline_id(pipeline_id)
        if not is_valid:
            return build_error_response(400, error_msg)

        is_valid, error_msg = validate_pipeline_data(body)
        if not is_valid:
            return build_error_response(400, error_msg)

        user_id = get_user_id(event)
        timestamp = datetime.utcnow().isoformat()

        # Check if pipeline exists
        existing = table.get_item(
            Key={
                'PK': f"USER#{user_id}",
                'SK': f"PIPELINE#{pipeline_id}"
            }
        )

        if 'Item' not in existing:
            return build_error_response(404, "Pipeline not found")

        # Update pipeline
        response = table.update_item(
            Key={
                'PK': f"USER#{user_id}",
                'SK': f"PIPELINE#{pipeline_id}"
            },
            UpdateExpression='SET #name = :name, description = :desc, nodes = :nodes, edges = :edges, version = version + :inc, updatedAt = :updated',
            ExpressionAttributeNames={
                '#name': 'name'
            },
            ExpressionAttributeValues={
                ':name': body['name'],
                ':desc': body.get('description', ''),
                ':nodes': body['nodes'],
                ':edges': body['edges'],
                ':inc': 1,
                ':updated': timestamp
            },
            ReturnValues='ALL_NEW'
        )

        return build_response(200, response['Attributes'])

    except KeyError:
        return build_error_response(400, "Pipeline ID is required")
    except json.JSONDecodeError:
        return build_error_response(400, "Invalid JSON in request body")
    except Exception as e:
        print(f"Error: {str(e)}")
        return build_error_response(500, "Internal server error")
