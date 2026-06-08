"""
Pipeline Generation Agent — creates structured CI/CD pipelines
based on repository analysis results.
"""
import os
import logging
from strands import Agent
from strands.models import BedrockModel

from typing import Any

from .prompts.system_prompts import PIPELINE_GEN_SYSTEM_PROMPT
from .tools.builder_tools import build_pipeline_tools

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0')


def build_agent(state: dict[str, Any]) -> Agent:
    """
    Build the Pipeline Generation agent.

    The agent constructs the pipeline by calling the tools, which write into the
    shared `state` dict; read the final pipeline via assemble_pipeline(state).

    Args:
        state: The shared pipeline state container the tools write into.
    """
    model = BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)

    return Agent(
        model=model,
        system_prompt=PIPELINE_GEN_SYSTEM_PROMPT,
        tools=build_pipeline_tools(state),
    )
