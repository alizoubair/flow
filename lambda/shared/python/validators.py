"""
Validation utilities for Pipeline data
"""

def validate_pipeline_data(data):
    """
    Validate pipeline data structure
    Returns (is_valid, error_message)
    """
    if not data:
        return False, "Request body is required"

    if 'name' not in data or not data['name']:
        return False, "Pipeline name is required"

    if len(data['name']) > 100:
        return False, "Pipeline name must be less than 100 characters"

    if 'nodes' not in data:
        return False, "Nodes array is required"

    if 'edges' not in data:
        return False, "Edges array is required"

    if not isinstance(data['nodes'], list):
        return False, "Nodes must be an array"

    if not isinstance(data['edges'], list):
        return False, "Edges must be an array"

    return True, None


def validate_pipeline_id(pipeline_id):
    """
    Validate pipeline ID format (UUID only)
    Returns (is_valid, error_message)
    """
    if not pipeline_id:
        return False, "Pipeline ID is required"

    # Accept UUID format only
    import re
    uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    if not re.match(uuid_pattern, pipeline_id):
        return False, "Invalid pipeline ID format"

    return True, None
