"""
AgentCore Memory integration using the hook-based pattern.

Uses MemoryClient directly with Strands hooks to:
- Load recent conversation turns when the agent starts
- Save each message after it's processed
- Extract long-term preferences and facts across sessions
"""
import os
import logging
from strands.hooks import AgentInitializedEvent, HookProvider, MessageAddedEvent

from bedrock_agentcore.memory import MemoryClient

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
MEMORY_ID = os.environ.get('MEMORY_ID', '')

# Initialize memory client (module-level singleton)
memory_client = MemoryClient(region_name=AWS_REGION) if MEMORY_ID else None


class MemoryHook(HookProvider):
    """
    Strands hook that handles memory operations:
    - on_agent_initialized: loads last K conversation turns into context
    - on_message_added: saves each message to AgentCore Memory
    """

    def __init__(self, memory_id: str, actor_id: str, session_id: str, k: int = 2):
        self.memory_id = memory_id
        self.actor_id = actor_id
        self.session_id = session_id
        self.k = k

    def on_agent_initialized(self, event: AgentInitializedEvent):
        """Load recent conversation history when the agent starts."""
        if not memory_client:
            return

        try:
            turns = memory_client.get_last_k_turns(
                memory_id=self.memory_id,
                actor_id=self.actor_id,
                session_id=self.session_id,
                k=self.k,
            )

            if turns:
                context = '\n'.join([
                    f"{m['role']}: {m['content']['text']}"
                    for t in turns for m in t
                ])
                event.agent.system_prompt += f'\n\nPrevious conversation:\n{context}'
                logger.info(f'Loaded {len(turns)} turns from memory')
        except Exception as e:
            logger.warning(f'Failed to load memory: {e}')

    def on_message_added(self, event: MessageAddedEvent):
        """Save the latest message to memory after each turn."""
        if not memory_client:
            return

        try:
            msg = event.agent.messages[-1]
            role = msg.get('role', 'user').upper()
            content = msg.get('content', '')

            # Extract text from content. Strands/Bedrock content blocks are
            # dicts like {'text': '...'}, {'toolUse': {...}}, {'toolResult': {...}}
            # with no 'type' key, so we key off the presence of a 'text' field.
            # This also naturally skips tool-use / tool-result blocks.
            if isinstance(content, list):
                text_parts = [
                    block['text'] for block in content
                    if isinstance(block, dict) and isinstance(block.get('text'), str)
                ]
                text = ' '.join(text_parts)
            else:
                text = str(content)

            if text.strip():
                memory_client.create_event(
                    memory_id=self.memory_id,
                    actor_id=self.actor_id,
                    session_id=self.session_id,
                    messages=[(text, role)],
                )
        except Exception as e:
            logger.warning(f'Failed to save to memory: {e}')

    def register_hooks(self, registry):
        """Register both hooks with the agent."""
        registry.add_callback(AgentInitializedEvent, self.on_agent_initialized)
        registry.add_callback(MessageAddedEvent, self.on_message_added)


def create_memory_hook(user_id: str, session_id: str) -> MemoryHook | None:
    """
    Create a MemoryHook if MEMORY_ID is configured.

    Args:
        user_id: Actor ID (Cognito sub)
        session_id: Session identifier

    Returns:
        MemoryHook instance or None if memory is not configured
    """
    if not MEMORY_ID:
        logger.info('MEMORY_ID not set, memory disabled')
        return None

    return MemoryHook(
        memory_id=MEMORY_ID,
        actor_id=user_id,
        session_id=session_id,
    )
