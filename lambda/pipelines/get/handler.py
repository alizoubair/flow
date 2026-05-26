"""
Lambda function to get a pipeline by ID
GET /pipelines/{id}
"""
import sys
from boto3.dynamodb.conditions import Key

sys.path.append('/opt/python')
from db_utils import table, get_user_id, build_response, build_error_response
from validators import validate_pipeline_id


def lambda_handler(event, context):
    try:
        pipeline_id = event['pathParameters']['id']

        is_valid, error_msg = validate_pipeline_id(pipeline_id)
        if not is_valid:
            return build_error_response(400, error_msg)

        user_id = get_user_id(event)

        response = table.get_item(
            Key={
                'PK': f"USER#{user_id}",
                'SK': f"PIPELINE#{pipeline_id}"
            }
        )

        if 'Item' not in response:
            return build_error_response(404, "Pipeline not found")

        return build_response(200, response['Item'])

    except KeyError:
        return build_error_response(400, "Pipeline ID is required")
    except Exception as e:
        print(f"Error: {str(e)}")
        return build_error_response(500, "Internal server error")
