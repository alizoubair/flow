# Flow Repo Analysis Agent

AWS Bedrock AgentCore runtime for analyzing Git repositories.

## Architecture

This agent runs as a containerized service using:
- **Strands Agents** for LLM-powered analysis
- **AWS Bedrock AgentCore** for agent runtime
- **GitHub API** for repository inspection

## Environment Variables

- `BEDROCK_MODEL_ID` - Bedrock model for analysis (default: Claude Sonnet 4.5)
- `GITHUB_TOKEN` - GitHub PAT for API access (optional, increases rate limits)
- `AWS_REGION` - AWS region (default: us-west-2)

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
export AWS_REGION=us-west-2
export GITHUB_TOKEN=ghp_...
python -c "from src.handler import app; app.run()"
```

## Building

```bash
# Build Docker image
docker build -t flow-repo-analysis:latest .

# Run container
docker run -p 8080:8080 \
  -e AWS_REGION=us-west-2 \
  -e GITHUB_TOKEN=ghp_... \
  flow-repo-analysis:latest
```

## Deployment

The container is built and deployed via AWS CodeBuild using Terraform:

```bash
cd infrastructure/terraform/environments/dev
terraform apply -target=module.repo_analysis_runtime
```

## API Endpoints

### Health Check
```
GET /ping
```

### Invoke Agent
```
POST /invocations
Content-Type: application/json

{
  "repo_url": "https://github.com/owner/repo",
  "provider": "github"
}
```

### Response Format

```json
{
  "language": "JavaScript",
  "framework": "Express",
  "package_manager": "npm",
  "test_framework": "jest",
  "build_tool": "webpack",
  "has_docker": true,
  "has_ci": true,
  "ci_platform": "github_actions",
  "deploy_targets": ["aws", "docker"],
  "detected_files": ["package.json", "Dockerfile", ".github/workflows"],
  "summary": "Node.js Express API with Jest tests and Docker"
}
```
