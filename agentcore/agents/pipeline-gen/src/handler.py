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
    analysis = payload.get('analysis', {})

    if not analysis:
        return json.dumps({'error': 'analysis is required'})

    logger.info(f'Generating pipeline for: {analysis.get("language", "unknown")} / {analysis.get("framework", "unknown")}')

    agent = build_agent()
    result = agent(f'Generate a CI/CD pipeline for this project:\n{json.dumps(analysis, indent=2)}')

    return str(result)


if __name__ == '__main__':
    app.run()
