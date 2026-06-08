"""
Pipeline Generation Agent — AgentCore Runtime entrypoint.

Receives a repo analysis and returns a structured pipeline
with stages, tasks, and connections.

Expected payload:
{
    "analysis": {
        "language": "JavaScript",
        "framework": "Express",
        "package_manager": "npm",
        "test_framework": "jest",
        "has_docker": true,
        "has_ci": false,
        "deploy_targets": ["aws"]
    }
}
"""
import os
import json
import logging
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from .agent import build_agent
from .tools.builder_tools import new_pipeline_state, assemble_pipeline

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

app = BedrockAgentCoreApp()


@app.entrypoint
def handler(payload: dict, context) -> str:
    """
    AgentCore Runtime entrypoint for pipeline generation.

    Args:
        payload: Contains the repo analysis JSON
        context: RequestContext from AgentCore Runtime

    Returns:
        JSON string with the generated pipeline (stages + edges)
    """
    analysis = payload.get('analysis') or payload.get('task') or {}

    if not analysis:
        return json.dumps({'error': 'analysis is required'})

    logger.info(f'Generating pipeline for: {analysis.get("language", "unknown")} / {analysis.get("framework", "unknown")}')

    state = new_pipeline_state()
    agent = build_agent(state)
    agent(f'Generate a CI/CD pipeline for this project:\n{json.dumps(analysis, indent=2)}')

    if not state['stages']:
        logger.warning('Agent produced no stages via builder tools.')
        return json.dumps({'error': 'pipeline generation produced no stages'})

    return json.dumps(assemble_pipeline(state))


if __name__ == '__main__':
    app.run()
