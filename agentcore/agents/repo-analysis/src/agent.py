"""
Repo Analysis Agent — analyzes Git repositories to detect tech stack,
frameworks, dependencies, and existing CI/CD configurations.
"""
import os
import logging
from strands import Agent
from strands.models import BedrockModel

from .tools.github_tools import get_repo_info, get_file_tree, read_file_content, check_files_exist
from .prompts.system_prompts import REPO_ANALYSIS_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0')


def build_agent() -> Agent:
    """Build the Repo Analysis Strands agent."""
    model = BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)

    return Agent(
        model=model,
        system_prompt=REPO_ANALYSIS_SYSTEM_PROMPT,
        tools=[get_repo_info, get_file_tree, read_file_content, check_files_exist],
    )
