"""
Lambda function to create a new pipeline
POST /pipelines
"""
import json
import sys
from datetime import datetime
from uuid import uuid4

sys.path.append('/opt/python')
from db_utils import table, get_user_id, build_response, build_error_response
from validators import validate_pipeline_data


def lambda_handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))

        is_valid, error_msg = validate_pipeline_data(body)
        if not is_valid:
            return build_error_response(400, error_msg)

        user_id = get_user_id(event)
        pipeline_id = str(uuid4())
        timestamp = datetime.utcnow().isoformat()

        pipeline = {
            'PK': f"USER#{user_id}",
            'SK': f"PIPELINE#{pipeline_id}",
            'id': pipeline_id,
            'userId': user_id,
            'name': body['name'],
            'description': body.get('description', ''),
            'nodes': body['nodes'],
            'edges': body['edges'],
            'status': 'draft',
            'version': 1,
            'createdAt': timestamp,
            'updatedAt': timestamp,
        }

        table.put_item(Item=pipeline)

        return build_response(201, pipeline)

    except json.JSONDecodeError:
        return build_error_response(400, "Invalid JSON in request body")
    except Exception as e:
        print(f"Error: {str(e)}")
        return build_error_response(500, "Internal server error")
