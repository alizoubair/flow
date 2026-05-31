"""
Pipeline Generation Agent — creates structured CI/CD pipelines
based on repository analysis results.
"""
import os
import logging
from strands import Agent
from strands.models import BedrockModel

from .prompts.system_prompts import PIPELINE_GEN_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0')


def build_agent() -> Agent:
    """Build the Pipeline Generation Strands agent."""
    model = BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)

    return Agent(
        model=model,
        system_prompt=PIPELINE_GEN_SYSTEM_PROMPT,
    )
