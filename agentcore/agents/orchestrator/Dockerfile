FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port 8080 (AgentCore Runtime default port)
EXPOSE 8080

# Health check endpoint for AgentCore Runtime
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/ping')"

# Run via BedrockAgentCoreApp which serves /invocations and /ping on port 8080.
# Wrapped in opentelemetry-instrument (ADOT) so AgentCore memory/runtime spans
# and logs are exported to CloudWatch. The runtime injects the OTLP endpoint
# when AGENT_OBSERVABILITY_ENABLED=true.
CMD ["opentelemetry-instrument", "python", "-c", "from src.handler import app; app.run()"]
