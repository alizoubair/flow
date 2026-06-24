"""Strands + ADOT telemetry bootstrap for AgentCore runtimes."""
import logging
import os

logger = logging.getLogger(__name__)
_configured = False


def setup_strands_telemetry() -> None:
    """Enable Strands GenAI spans when AgentCore observability is on."""
    global _configured
    if _configured:
        return
    if os.environ.get('AGENT_OBSERVABILITY_ENABLED', '').lower() != 'true':
        return

    try:
        from strands.telemetry import StrandsTelemetry

        # ADOT (opentelemetry-instrument) configures the global TracerProvider on
        # AgentCore; Strands attaches gen_ai.* spans with per-invocation token usage.
        StrandsTelemetry().setup_otlp_exporter()
        _configured = True
        logger.info('Strands OTLP telemetry enabled (gen_ai token spans)')
    except ImportError as exc:
        logger.error(
            'Strands telemetry unavailable — install strands-agents[otel]: %s', exc
        )
    except Exception as exc:
        logger.exception('Strands telemetry setup failed: %s', exc)
