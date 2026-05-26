"""
Lambda function to delete a pipeline
DELETE /pipelines/{id}
"""
import sys

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

        # Check if pipeline exists
        existing = table.get_item(
            Key={
                'PK': f"USER#{user_id}",
                'SK': f"PIPELINE#{pipeline_id}"
            }
        )

        if 'Item' not in existing:
            return build_error_response(404, "Pipeline not found")

        # Delete pipeline
        table.delete_item(
            Key={
                'PK': f"USER#{user_id}",
                'SK': f"PIPELINE#{pipeline_id}"
            }
        )

        return build_response(200, {
            'message': 'Pipeline deleted successfully',
            'id': pipeline_id
        })

    except KeyError:
        return build_error_response(400, "Pipeline ID is required")
    except Exception as e:
        print(f"Error: {str(e)}")
        return build_error_response(500, "Internal server error")
