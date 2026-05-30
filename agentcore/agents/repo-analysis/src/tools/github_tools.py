"""
GitHub API tools for repository analysis.
Fetches repo metadata, file tree, and key config files.
"""
import os
import base64
import logging
import requests
from strands import tool

logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
GITHUB_API = 'https://api.github.com'


def _headers():
    h = {'Accept': 'application/vnd.github.v3+json'}
    if GITHUB_TOKEN:
        h['Authorization'] = f'token {GITHUB_TOKEN}'
    return h


def _parse_repo_url(repo_url: str) -> tuple[str, str]:
    """Extract owner/repo from a GitHub URL."""
    # Handle: https://github.com/owner/repo or github.com/owner/repo
    parts = repo_url.rstrip('/').split('/')
    if len(parts) >= 2:
        return parts[-2], parts[-1].replace('.git', '')
    raise ValueError(f'Cannot parse repo URL: {repo_url}')


@tool
def get_repo_info(repo_url: str) -> dict:
    """
    Get basic repository metadata from GitHub.

    Args:
        repo_url: Full GitHub repository URL (e.g. https://github.com/owner/repo)

    Returns:
        Repository metadata including language, description, default branch
    """
    owner, repo = _parse_repo_url(repo_url)
    resp = requests.get(f'{GITHUB_API}/repos/{owner}/{repo}', headers=_headers(), timeout=10)
    resp.raise_for_status()
    data = resp.json()

    return {
        'name': data.get('name'),
        'description': data.get('description', ''),
        'language': data.get('language', 'Unknown'),
        'default_branch': data.get('default_branch', 'main'),
        'topics': data.get('topics', []),
        'has_wiki': data.get('has_wiki', False),
        'size_kb': data.get('size', 0),
    }


@tool
def get_file_tree(repo_url: str, path: str = '') -> list:
    """
    Get the file/directory listing at a given path in the repository.
    Use path='' for root. Only returns top-level items (not recursive).

    Args:
        repo_url: Full GitHub repository URL
        path: Directory path within the repo (empty string for root)

    Returns:
        List of file/directory names with their types
    """
    owner, repo = _parse_repo_url(repo_url)
    url = f'{GITHUB_API}/repos/{owner}/{repo}/contents/{path}'
    resp = requests.get(url, headers=_headers(), timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if not isinstance(data, list):
        return [{'name': data.get('name'), 'type': data.get('type')}]

    return [{'name': item['name'], 'type': item['type']} for item in data]


@tool
def read_file_content(repo_url: str, file_path: str) -> str:
    """
    Read the content of a specific file from the repository.
    Use this to read package.json, requirements.txt, Dockerfile, etc.

    Args:
        repo_url: Full GitHub repository URL
        file_path: Path to the file (e.g. 'package.json', 'src/main.py')

    Returns:
        File content as a string (truncated to 5000 chars for large files)
    """
    owner, repo = _parse_repo_url(repo_url)
    url = f'{GITHUB_API}/repos/{owner}/{repo}/contents/{file_path}'
    resp = requests.get(url, headers=_headers(), timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get('encoding') == 'base64':
        content = base64.b64decode(data['content']).decode('utf-8', errors='replace')
    else:
        content = data.get('content', '')

    # Truncate large files
    if len(content) > 5000:
        content = content[:5000] + '\n... (truncated)'

    return content


@tool
def check_files_exist(repo_url: str, file_paths: list) -> dict:
    """
    Check which files exist in the repository root.
    Useful for quickly detecting Dockerfile, CI configs, etc.

    Args:
        repo_url: Full GitHub repository URL
        file_paths: List of file paths to check (e.g. ['Dockerfile', '.github/workflows', '.gitlab-ci.yml'])

    Returns:
        Dict mapping file_path to boolean (exists or not)
    """
    owner, repo = _parse_repo_url(repo_url)
    results = {}

    for path in file_paths:
        url = f'{GITHUB_API}/repos/{owner}/{repo}/contents/{path}'
        try:
            resp = requests.get(url, headers=_headers(), timeout=5)
            results[path] = resp.status_code == 200
        except Exception:
            results[path] = False

    return results
