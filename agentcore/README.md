# AgentCore

Multi-agent backend for the [Flow Platform](../README.md) — an agentic CI/CD pipeline builder built on [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/) and [Strands Agents](https://github.com/strands-agents/sdk-python).

Agents run as containerized HTTP services on **AgentCore Runtime**. The **orchestrator** coordinates specialized sub-agents; external tools (GitHub repo inspection) are exposed through **AgentCore Gateway** as MCP tools.

## Repository layout

```
agentcore/
├── agents/                    # One folder per AgentCore Runtime container
│   ├── orchestrator/
│   ├── repo-analysis/
│   ├── pipeline-gen/
│   ├── validation/
│   └── export/
├── shared/                    # Code reused across agent runtimes
│   └── gateway/               # MCP client + Cognito M2M auth for AgentCore Gateway
└── gateway-tools/             # Lambda functions registered as Gateway MCP targets
    └── lambda-functions/
        └── source-control/    # GitHub repo inspection tools
```

Each agent folder follows the same shape:

- `Dockerfile` — container image for AgentCore Runtime
- `buildspec.yml` — CodeBuild (ARM64) push to ECR
- `requirements.txt` — Python dependencies
- `src/handler.py` — `BedrockAgentCoreApp` entrypoint
- `src/agent.py` — Strands agent construction
- `README.md` — agent-specific notes

## AgentCore Gateway (MCP)

Gateway exposes Lambda-backed tools to agents over the MCP protocol.

**Tool side** (`gateway-tools/`):

- One Lambda per logical domain (e.g. `source-control` with `get_repo_info`, `get_file_tree`, …)
- Deployed via Terraform modules `gateway-lambda-tool` + `agentcore/gateway`
- Tool schemas: `infrastructure/terraform/modules/agentcore/gateway/schemas/*.yaml`

**Agent side** (`shared/gateway/`):

- `auth.py` — Cognito **client credentials** token (M2M) for Gateway inbound JWT auth
- `mcp_client.py` — Strands `MCPClient` wrapper; maps `source-control___get_repo_info` → `get_repo_info`

Agents that use Gateway must:

1. Import `from shared.gateway.mcp_client import create_gateway_mcp_client`
2. Bundle `agentcore/shared` in the runtime image (see repo-analysis `Dockerfile` + Terraform `additional_source_paths`)
3. Receive env vars: `GATEWAY_MCP_URL`, `GATEWAY_AUTH_SECRET_ARN`, `COGNITO_TOKEN_URL`

Sub-agents are invoked by the orchestrator via SigV4 (`InvokeAgentRuntime`), not the user's browser JWT — hence M2M auth instead of forwarding the Cognito session token.

## Local development

From the repo root, set `PYTHONPATH` so `shared` imports resolve:

```bash
export PYTHONPATH="$(pwd)/agentcore"
cd agentcore/agents/repo-analysis
pip install -r requirements.txt
```

Running an agent locally also requires AWS credentials and the same env vars as its AgentCore Runtime (see Terraform `extra_env_vars` in `infrastructure/terraform/environments/dev/main.tf`).

Docker (matches production layout):

```bash
cd agentcore/agents/repo-analysis
# Copy shared into build context (Terraform does this automatically on deploy)
cp -r ../../shared ./shared
docker build -t flow-repo-analysis .
```

## Deployment

Agent runtimes are built and deployed through Terraform (`module.agentcore/runtime`):

- Source is zipped to S3; CodeBuild builds the Docker image and pushes to ECR
- Image tags are **content-hash based** so source changes trigger a runtime update
- Agents with shared code pass `additional_source_paths = [agentcore/shared]`

Apply the dev environment:

```bash
cd infrastructure/terraform/environments/dev
terraform apply
```

Target a single runtime:

```bash
terraform apply -target=module.repo_analysis_runtime
```

Gateway + tool Lambdas:

```bash
terraform apply -target=module.source_control_tool -target=module.gateway
```

## Per-agent documentation

- [orchestrator](agents/orchestrator/README.md)
- [repo-analysis](agents/repo-analysis/README.md)
- [pipeline-gen](agents/pipeline-gen/README.md)
- [validation](agents/validation/README.md)
- [export](agents/export/README.md)