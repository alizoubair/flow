"""
Repo Analysis Agent — analyzes Git repositories to detect tech stack,
frameworks, dependencies, and existing CI/CD configurations.

Repository tools are provided via AgentCore Gateway MCP (source-control target).
"""
import logging
import os
from strands import Agent
from strands.models import BedrockModel

from shared.gateway.mcp_client import create_gateway_mcp_client
from .prompts.system_prompts import REPO_ANALYSIS_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.anthropic.claude-haiku-4-5-20251001-v1:0')


def analyze_repository(repo_url: str) -> str:
    """
    Run repo analysis using Gateway MCP tools.

    Opens an MCP session for the duration of the agent run.
    """
    mcp_client = create_gateway_mcp_client()
    if mcp_client is None:
        raise RuntimeError('Gateway MCP is not configured (set GATEWAY_MCP_URL)')

    model = BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)

    with mcp_client:
        tools = mcp_client.list_tools_sync()
        agent = Agent(
            model=model,
            system_prompt=REPO_ANALYSIS_SYSTEM_PROMPT,
            tools=tools,
        )
        return str(agent(f'Analyze this GitHub repository: {repo_url}'))
