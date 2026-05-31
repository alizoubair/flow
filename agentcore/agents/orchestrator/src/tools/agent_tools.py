"""
Orchestrator agent tools — each tool delegates to a specialized sub-agent
via InvokeAgentRuntime and returns the result.
"""
import os
import logging
from strands import tool
from ..runtime_client import call_agent

logger = logging.getLogger(__name__)

REPO_ANALYSIS_RUNTIME_ARN = os.environ.get('REPO_ANALYSIS_AGENT_URL', '')
PIPELINE_GEN_RUNTIME_ARN = os.environ.get('PIPELINE_GEN_AGENT_URL', '')


def build_tools(user_id: str, session_id: str) -> list:
    """
    Build all agent tools bound to the current user session.
    Returns a list of Strands tool functions.
    """

    @tool
    def analyze_repository(repo_url: str, provider: str = 'github') -> dict:
        """
        Analyze a Git repository to detect tech stack, frameworks, dependencies,
        and existing CI/CD configurations.

        Args:
            repo_url: Full repository URL (e.g. https://github.com/user/repo)
            provider: Git provider — github, gitlab, or azure

        Returns:
            RepoAnalysis with language, framework, package_manager,
            test_framework, has_docker, has_ci, detected_files
        """
        if not REPO_ANALYSIS_RUNTIME_ARN:
            return {'error': 'Repo analysis agent not configured'}

        return call_agent(
            runtime_arn=REPO_ANALYSIS_RUNTIME_ARN,
            task={'repo_url': repo_url, 'provider': provider},
            user_id=user_id,
            session_id=session_id,
        )

    @tool
    def generate_pipeline(repo_analysis: dict) -> dict:
        """
        Generate a structured CI/CD pipeline based on repository analysis results.

        Args:
            repo_analysis: The analysis object from analyze_repository containing
                language, framework, package_manager, test_framework, has_docker, etc.

        Returns:
            Pipeline JSON with name, stages, and edges ready for canvas rendering.
        """
        if not PIPELINE_GEN_RUNTIME_ARN:
            return {'error': 'Pipeline generation agent not configured'}

        return call_agent(
            runtime_arn=PIPELINE_GEN_RUNTIME_ARN,
            task=repo_analysis,
            user_id=user_id,
            session_id=session_id,
        )

    return [
        analyze_repository,
        generate_pipeline,
    ]
