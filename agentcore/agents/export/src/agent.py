"""
Export Agent — converts abstract CI/CD pipeline definitions
into runnable configuration files for specific platforms.
"""
import os
import logging
from strands import Agent
from strands.models import BedrockModel

from .prompts.system_prompts import EXPORT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.anthropic.claude-haiku-4-5-20251001-v1:0')


def build_agent() -> Agent:
    """Build the Export Strands agent."""
    model = BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)

    return Agent(
        model=model,
        system_prompt=EXPORT_SYSTEM_PROMPT,
    )
