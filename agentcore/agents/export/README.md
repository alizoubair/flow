# Flow Export Agent

AWS Bedrock AgentCore runtime for exporting CI/CD pipelines to platform-specific configuration files.

## Architecture

This agent runs as a containerized service using:
- **Strands Agents** for LLM-powered config generation
- **AWS Bedrock AgentCore** for agent runtime

## Supported Targets

| Target | Output File |
|--------|-------------|
| `github-actions` | `.github/workflows/ci.yml` |
| `gitlab-ci` | `.gitlab-ci.yml` |
| `aws-codepipeline` | `buildspec.yml` |
| `jenkinsfile` | `Jenkinsfile` |
| `bitbucket-pipelines` | `bitbucket-pipelines.yml` |

## Environment Variables

- `BEDROCK_MODEL_ID` - Bedrock model for generation (default: Claude Sonnet 4.5)
- `AWS_REGION` - AWS region (default: us-west-2)

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
export AWS_REGION=us-west-2
python -c "from src.handler import app; app.run()"
```

## Building

```bash
# Build Docker image
docker build -t flow-export:latest .

# Run container
docker run -p 8080:8080 \
  -e AWS_REGION=us-west-2 \
  flow-export:latest
```

## Deployment

```bash
cd infrastructure/terraform/environments/dev
terraform apply -target=module.export_runtime
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
  "pipeline": {
    "name": "Express API Pipeline",
    "stages": [
      { "id": "stage-1", "type": "install", "label": "Install Dependencies", "config": {"commands": ["npm ci"]} },
      { "id": "stage-2", "type": "test", "label": "Run Tests", "config": {"commands": ["npm test"]} },
      { "id": "stage-3", "type": "build", "label": "Build", "config": {"commands": ["npm run build"]} }
    ],
    "edges": [
      { "source": "stage-1", "target": "stage-2" },
      { "source": "stage-2", "target": "stage-3" }
    ]
  },
  "target": "github-actions"
}
```

### Response Format

```json
{
  "target": "github-actions",
  "filename": ".github/workflows/ci.yml",
  "content": "name: Express API Pipeline\non:\n  push:\n    branches: [main]\njobs:\n  install:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n  ...",
  "summary": "3 jobs with install, test, and build stages"
}
```
