"""
Lambda function to list all pipelines for a user
GET /pipelines
"""
import sys
from boto3.dynamodb.conditions import Key

sys.path.append('/opt/python')
from db_utils import table, get_user_id, build_response, build_error_response


def lambda_handler(event, context):
    try:
        user_id = get_user_id(event)

        response = table.query(
            KeyConditionExpression=Key('PK').eq(f"USER#{user_id}") & Key('SK').begins_with('PIPELINE#'),
            ScanIndexForward=False  # Sort by SK descending (newest first)
        )

        pipelines = response.get('Items', [])

        # Return simplified list (exclude full nodes/edges for performance)
        pipeline_list = [{
            'id': p['id'],
            'name': p['name'],
            'description': p.get('description', ''),
            'version': p.get('version', 1),
            'createdAt': p['createdAt'],
            'updatedAt': p['updatedAt'],
        } for p in pipelines]

        return build_response(200, {
            'pipelines': pipeline_list,
            'count': len(pipeline_list)
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return build_error_response(500, "Internal server error")
