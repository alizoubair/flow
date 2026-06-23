"""
Repo Analysis Agent — AgentCore Runtime entrypoint.

Receives task requests with a repo URL and returns
a structured analysis of the repository's tech stack.

Expected payload (from orchestrator InvokeAgentRuntime):
{
    "task": {
        "repo_url": "https://github.com/owner/repo",
        "provider": "github"
    },
    "metadata": { "userId": "...", "sessionId": "..." }
}
"""
import os
import json
import logging
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from shared.telemetry import setup_strands_telemetry
from .agent import analyze_repository

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

setup_strands_telemetry()

app = BedrockAgentCoreApp()


@app.entrypoint
def handler(payload: dict, context) -> str:
    """
    AgentCore Runtime entrypoint for repo analysis.

    Args:
        payload: Contains task with repo_url and provider
        context: RequestContext from AgentCore Runtime

    Returns:
        JSON string with repository analysis results
    """
    task = payload.get('task') or payload
    repo_url = task.get('repo_url', '')
    provider = task.get('provider', 'github')

    if not repo_url:
        return json.dumps({'error': 'repo_url is required'})

    if provider != 'github':
        return json.dumps({'error': f'Provider {provider} not yet supported. Only github is available.'})

    logger.info('Analyzing repository via Gateway MCP: %s', repo_url)

    try:
        result = analyze_repository(repo_url)
        return result
    except Exception as e:
        logger.error('Repo analysis failed: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})


if __name__ == '__main__':
    app.run()
