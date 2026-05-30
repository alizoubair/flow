"""
Orchestrator Agent — coordinates specialized agents to generate CI/CD pipelines.

Runs inside Amazon Bedrock AgentCore Runtime. Memory is managed via
hooks that read/write to AgentCore Memory.
"""
import os
import logging
from strands import Agent
from strands.models import BedrockModel

from .memory import create_memory_hook
from .tools.agent_tools import build_tools
from .tools.websocket_tools import build_progress_tool
from .prompts.system_prompts import ORCHESTRATOR_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.anthropic.claude-sonnet-4-6')


def build_orchestrator(
    user_id: str,
    session_id: str,
    connection_id: str = '',
    ws_endpoint: str = '',
) -> Agent:
    """
    Build the Orchestrator Strands agent with memory and tools.

    Args:
        user_id: Cognito sub of the authenticated user
        session_id: Session identifier for memory scoping
        connection_id: WebSocket connection ID for progress updates
        ws_endpoint: API Gateway Management API endpoint
    """
    model = BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)

    # Build tools
    agent_tools = build_tools(user_id=user_id, session_id=session_id)
    progress_tool = build_progress_tool(connection_id, ws_endpoint, AWS_REGION)
    tools = [progress_tool] + agent_tools

    # Build memory hook
    hooks = []
    memory_hook = create_memory_hook(user_id, session_id)
    if memory_hook:
        hooks.append(memory_hook)

    return Agent(
        model=model,
        system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        tools=tools,
        hooks=hooks,
    )
