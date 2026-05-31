# Flow Pipeline Orchestrator Agent

AWS Bedrock AgentCore runtime for orchestrating CI/CD pipelines.

## Architecture

This agent runs as a containerized service using:
- **FastAPI** for HTTP endpoints
- **AWS Bedrock AgentCore** for agent runtime
- **DynamoDB** for pipeline state storage
- **S3** for build artifacts
- **AgentCore Memory** for context persistence

## Environment Variables

- `PIPELINES_TABLE_NAME` - DynamoDB table for pipeline data
- `MEMORY_ID` - AgentCore memory ID
- `HTTP_API_ENDPOINT` - API Gateway endpoint for pipeline operations
- `WS_API_ENDPOINT` - WebSocket endpoint for real-time updates
- `AWS_REGION` - AWS region

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
export PIPELINES_TABLE_NAME=flow-dev-pipelines
export AWS_REGION=us-east-1
python main.py
```

## Building

```bash
# Build Docker image
docker build -t flow-orchestrator:latest .

# Run container
docker run -p 8080:8080 \
  -e PIPELINES_TABLE_NAME=flow-dev-pipelines \
  -e AWS_REGION=us-east-1 \
  flow-orchestrator:latest
```

## Deployment

The container is built and deployed via AWS CodeBuild using the deployment script:

```bash
cd infrastructure/scripts
./deploy-agent.sh orchestrator dev
```

This script will:
1. Validate the agent source code and Dockerfile
2. Package the orchestrator source code
3. Upload to S3 artifacts bucket
4. Trigger CodeBuild to build and push the Docker image to ECR

The script is generic and can deploy any agent:
```bash
./deploy-agent.sh <agent-name> [environment]
```

## API Endpoints

### Health Check
```
GET /health
```

### Invoke Agent
```
POST /invoke
Content-Type: application/json

{
  "action": "execute_pipeline",
  "pipeline_id": "pipeline-123",
  "params": {}
}
```
