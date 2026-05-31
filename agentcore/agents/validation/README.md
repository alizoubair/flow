# Flow Validation Agent

AWS Bedrock AgentCore runtime for validating CI/CD pipeline structure.

## Architecture

This agent runs as a containerized service using:
- **Strands Agents** for LLM-powered pipeline validation
- **AWS Bedrock AgentCore** for agent runtime

## Environment Variables

- `BEDROCK_MODEL_ID` - Bedrock model for validation (default: Claude Sonnet 4.5)
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
docker build -t flow-validation:latest .

# Run container
docker run -p 8080:8080 \
  -e AWS_REGION=us-west-2 \
  flow-validation:latest
```

## Deployment

```bash
cd infrastructure/terraform/environments/dev
terraform apply -target=module.validation_runtime
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
    "name": "My Pipeline",
    "stages": [
      { "id": "stage-1", "type": "install", "label": "Install Dependencies", "config": {} },
      { "id": "stage-2", "type": "test", "label": "Run Tests", "config": {} }
    ],
    "edges": [
      { "source": "stage-1", "target": "stage-2" }
    ]
  }
}
```

### Response Format

```json
{
  "valid": true,
  "score": 85,
  "checks": [
    { "name": "structure", "passed": true, "message": "All stages have required fields" },
    { "name": "connectivity", "passed": true, "message": "All stages are connected" },
    { "name": "circular_dependencies", "passed": true, "message": "No cycles detected" },
    { "name": "stage_ordering", "passed": true, "message": "Stage order is logical" },
    { "name": "missing_stages", "passed": false, "message": "Missing recommended stage: security scanning" }
  ],
  "suggestions": [
    "Add a security scanning stage before deploy",
    "Consider adding a Docker build stage"
  ]
}
```
