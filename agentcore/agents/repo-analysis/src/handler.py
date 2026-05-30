"""
Repo Analysis Agent — AgentCore Runtime entrypoint.

Receives task requests with a repo URL and returns
a structured analysis of the repository's tech stack.

Expected payload:
{
    "repo_url": "https://github.com/owner/repo",
    "provider": "github"
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
    AgentCore Runtime entrypoint for repo analysis.

    Args:
        payload: Contains repo_url and provider
        context: RequestContext from AgentCore Runtime

    Returns:
        JSON string with repository analysis results
    """
    repo_url = payload.get('repo_url', '')
    provider = payload.get('provider', 'github')

    if not repo_url:
        return json.dumps({'error': 'repo_url is required'})

    if provider != 'github':
        return json.dumps({'error': f'Provider {provider} not yet supported. Only github is available.'})

    logger.info(f'Analyzing repository: {repo_url}')

    agent = build_agent()
    result = agent(f'Analyze this repository: {repo_url}')

    return str(result)


if __name__ == '__main__':
    app.run()
