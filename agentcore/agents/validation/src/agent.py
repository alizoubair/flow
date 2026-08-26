"""
Validation Agent — validates CI/CD pipeline structure for
correctness, completeness, and best practices.
"""
import os
import logging
from strands import Agent
from strands.models import BedrockModel

from .prompts.system_prompts import VALIDATION_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.anthropic.claude-haiku-4-5-20251001-v1:0')


def build_agent() -> Agent:
    """Build the Validation Strands agent."""
    model = BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)

    return Agent(
        model=model,
        system_prompt=VALIDATION_SYSTEM_PROMPT,
    )
