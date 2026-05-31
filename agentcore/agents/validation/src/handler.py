"""
Validation Agent — AgentCore Runtime entrypoint.

Receives a pipeline JSON and returns validation results
with checks, score, and suggestions.

Expected payload:
{
    "pipeline": {
        "name": "My Pipeline",
        "stages": [...],
        "edges": [...]
    }
}
"""
import os
import json
import logging
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from .agent import build_agent

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

app = BedrockAgentCoreApp()


@app.entrypoint
def handler(payload: dict, context) -> str:
    """
    AgentCore Runtime entrypoint for pipeline validation.

    Args:
        payload: Contains the pipeline JSON to validate
        context: RequestContext from AgentCore Runtime

    Returns:
        JSON string with validation results (valid, score, checks, suggestions)
    """
    pipeline = payload.get('pipeline', {})

    if not pipeline:
        return json.dumps({'error': 'pipeline is required'})

    stage_count = len(pipeline.get('stages', []))
    edge_count = len(pipeline.get('edges', []))
    logger.info(f'Validating pipeline: {pipeline.get("name", "unnamed")} ({stage_count} stages, {edge_count} edges)')

    agent = build_agent()
    result = agent(f'Validate this CI/CD pipeline:\n{json.dumps(pipeline, indent=2)}')

    return str(result)


if __name__ == '__main__':
    app.run()
