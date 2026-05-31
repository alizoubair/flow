# Flow Pipeline Generation Agent

AWS Bedrock AgentCore runtime for generating structured CI/CD pipelines.

## Architecture

This agent runs as a containerized service using:
- **Strands Agents** for LLM-powered pipeline generation
- **AWS Bedrock AgentCore** for agent runtime

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
docker build -t flow-pipeline-gen:latest .

# Run container
docker run -p 8080:8080 \
  -e AWS_REGION=us-west-2 \
  flow-pipeline-gen:latest
```

## Deployment

```bash
cd infrastructure/terraform/environments/dev
terraform apply -target=module.pipeline_gen_runtime
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
  "analysis": {
    "language": "JavaScript",
    "framework": "Express",
    "package_manager": "npm",
    "test_framework": "jest",
    "has_docker": true,
    "has_ci": false,
    "deploy_targets": ["aws"]
  }
}
```

### Response Format

```json
{
  "name": "Express API Pipeline",
  "stages": [
    { "id": "stage-1", "type": "install", "label": "Install Dependencies", "config": {...} },
    { "id": "stage-2", "type": "test", "label": "Run Tests", "config": {...} },
    { "id": "stage-3", "type": "build", "label": "Build", "config": {...} },
    { "id": "stage-4", "type": "deploy", "label": "Deploy", "config": {...} }
  ],
  "edges": [
    { "source": "stage-1", "target": "stage-2" },
    { "source": "stage-2", "target": "stage-3" },
    { "source": "stage-3", "target": "stage-4" }
  ]
}
```
