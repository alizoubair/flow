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
VALIDATION_RUNTIME_ARN = os.environ.get('VALIDATION_AGENT_URL', '')
EXPORT_RUNTIME_ARN = os.environ.get('EXPORT_AGENT_URL', '')


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
        logger.info(f'generate_pipeline called. Analysis keys: {list(repo_analysis.keys()) if isinstance(repo_analysis, dict) else "N/A"}')
        if not PIPELINE_GEN_RUNTIME_ARN:
            return {'error': 'Pipeline generation agent not configured'}

        result = call_agent(
            runtime_arn=PIPELINE_GEN_RUNTIME_ARN,
            task=repo_analysis,
            user_id=user_id,
            session_id=session_id,
        )
        logger.info(f'generate_pipeline result preview: {str(result)[:200]}')
        return result

    @tool
    def validate_pipeline(pipeline: dict) -> dict:
        """
        Validate a CI/CD pipeline for correctness, completeness, and best practices.

        Args:
            pipeline: The pipeline JSON with name, stages, and edges to validate.

        Returns:
            Validation result with valid (bool), score (0-100), checks, and suggestions.
        """
        logger.info(f'validate_pipeline called. Pipeline name: {pipeline.get("name", "unknown") if isinstance(pipeline, dict) else "N/A"}')
        if not VALIDATION_RUNTIME_ARN:
            return {'error': 'Validation agent not configured'}

        result = call_agent(
            runtime_arn=VALIDATION_RUNTIME_ARN,
            task={'pipeline': pipeline},
            user_id=user_id,
            session_id=session_id,
        )
        logger.info(f'validate_pipeline result preview: {str(result)[:200]}')
        return result

    @tool
    def export_pipeline(pipeline: dict, target: str) -> dict:
        """
        Export a CI/CD pipeline to a platform-specific configuration file.

        Args:
            pipeline: The pipeline JSON with name, stages, and edges.
            target: Target platform — github-actions, gitlab-ci, aws-codepipeline,
                jenkinsfile, or bitbucket-pipelines.

        Returns:
            Export result with target, filename, content, and summary.
        """
        logger.info(f'export_pipeline called. Target: {target}, stages: {len(pipeline.get("stages", [])) if isinstance(pipeline, dict) else "N/A"}')
        if not EXPORT_RUNTIME_ARN:
            logger.warning('EXPORT_RUNTIME_ARN not configured')
            return {'error': 'Export agent not configured'}

        result = call_agent(
            runtime_arn=EXPORT_RUNTIME_ARN,
            task={'pipeline': pipeline, 'target': target},
            user_id=user_id,
            session_id=session_id,
        )
        logger.info(f'export_pipeline result preview: {str(result)[:200]}')
        return result

    return [
        analyze_repository,
        generate_pipeline,
        validate_pipeline,
        export_pipeline,
    ]
