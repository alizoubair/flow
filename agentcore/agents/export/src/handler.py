"""
Export Agent — AgentCore Runtime entrypoint.

Receives a pipeline JSON and target platform, returns a
runnable CI/CD configuration file.

Expected payload:
{
    "pipeline": {
        "name": "My Pipeline",
        "stages": [...],
        "edges": [...]
    },
    "target": "github-actions"
}
"""
import os
import json
import logging
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from shared.telemetry import setup_strands_telemetry
from .agent import build_agent

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

setup_strands_telemetry()

app = BedrockAgentCoreApp()

SUPPORTED_TARGETS = [
    'github-actions',
    'gitlab-ci',
    'aws-codepipeline',
    'jenkinsfile',
    'bitbucket-pipelines',
]


@app.entrypoint
def handler(payload: dict, context) -> str:
    """
    AgentCore Runtime entrypoint for pipeline export.

    Args:
        payload: Contains the pipeline JSON and target platform
        context: RequestContext from AgentCore Runtime

    Returns:
        JSON string with target, filename, content, and summary
    """
    task = payload.get('task') or payload
    pipeline = task.get('pipeline', {})
    target = task.get('target', '') or payload.get('target', '')

    if not pipeline:
        return json.dumps({'error': 'pipeline is required'})

    if not target:
        return json.dumps({'error': 'target is required', 'supported': SUPPORTED_TARGETS})

    if target not in SUPPORTED_TARGETS:
        return json.dumps({'error': f'Unsupported target: {target}', 'supported': SUPPORTED_TARGETS})

    stage_count = len(pipeline.get('stages', []))
    logger.info(f'Exporting pipeline "{pipeline.get("name", "unnamed")}" ({stage_count} stages) to {target}')

    agent = build_agent()
    result = agent(
        f'Export this CI/CD pipeline to {target} format:\n{json.dumps(pipeline, indent=2)}'
    )

    return str(result)


if __name__ == '__main__':
    app.run()
