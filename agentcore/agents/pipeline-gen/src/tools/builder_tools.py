"""
Pipeline generation tools.

The agent constructs the pipeline incrementally by calling these tools instead
of returning a JSON blob. Tool calls accumulate into a shared `state` dict, and
the handler reads the final pipeline via `assemble_pipeline(state)`.
"""
import logging
from typing import Any

from strands import tool

logger = logging.getLogger(__name__)


def new_pipeline_state() -> dict[str, Any]:
    """Create an empty pipeline state container for one generation run."""
    return {'name': '', 'stages': [], 'edges': []}


def assemble_pipeline(state: dict[str, Any]) -> dict[str, Any]:
    """Assemble the final pipeline JSON from the accumulated tool calls."""
    stages = state['stages']
    edges = list(state['edges'])

    # Guarantee a connected flow even if the agent forgot to connect stages.
    if not edges and len(stages) > 1:
        edges = [
            {'source': stages[i]['id'], 'target': stages[i + 1]['id']}
            for i in range(len(stages) - 1)
        ]

    return {
        'name': state['name'] or 'Generated Pipeline',
        'stages': stages,
        'edges': edges,
    }


def build_pipeline_tools(state: dict[str, Any]) -> list:
    """
    Build the granular pipeline-construction tools bound to a shared state dict.

    Args:
        state: The pipeline state container the tools write into.
    """

    def _find_stage(stage_id: str) -> dict[str, Any] | None:
        return next((s for s in state['stages'] if s['id'] == stage_id), None)

    @tool
    def set_pipeline_name(name: str) -> str:
        """
        Set the pipeline's display name. Call this once at the start.

        Args:
            name: A short, descriptive pipeline name based on the project.
        """
        state['name'] = name.strip()
        return f'Pipeline name set to: {name}'

    @tool
    def add_stage(stage_id: str, stage_type: str, label: str) -> str:
        """
        Add a stage (a phase of the pipeline). Stages run in the order defined by
        connect_stages. Add every stage before adding its tasks.

        Args:
            stage_id: Unique sequential id, e.g. "stage-1", "stage-2".
            stage_type: One of: install, lint, test, build, docker, security, deploy.
            label: Human-readable stage name, e.g. "Run Tests".

        Returns:
            Confirmation message.
        """
        existing = _find_stage(stage_id)
        if existing:
            existing.update({'type': stage_type, 'label': label})
        else:
            state['stages'].append({
                'id': stage_id,
                'type': stage_type,
                'label': label,
                'config': {},
                'tasks': [],
            })
        return f'Added stage {stage_id} ({stage_type}): {label}'

    @tool
    def add_task(stage_id: str, task_id: str, name: str, task_type: str,
                 commands: list[str], parallel: bool = False) -> str:
        """
        Add a task (a concrete unit of work) to an existing stage. Every stage
        must have at least one task, and every task must have commands.

        Args:
            stage_id: The id of the stage this task belongs to.
            task_id: Unique task id scoped to the stage, e.g. "task-2-1".
            name: Human-readable task name, e.g. "Unit Tests".
            task_type: One of: install, lint, test, build, docker, security, deploy.
            commands: Shell commands this task runs (non-empty list).
            parallel: True if this task runs concurrently with other parallel
                tasks in the same stage.

        Returns:
            Confirmation message.
        """
        if not commands:
            return f'Task {task_id} rejected: commands must not be empty.'

        stage = _find_stage(stage_id)
        if stage is None:
            # Auto-create the stage so a misordered call doesn't drop the task.
            state['stages'].append({
                'id': stage_id,
                'type': task_type,
                'label': name,
                'config': {},
                'tasks': [],
            })
            stage = state['stages'][-1]

        stage['tasks'].append({
            'id': task_id,
            'name': name,
            'type': task_type,
            'commands': list(commands),
            'parallel': bool(parallel),
        })
        return f'Added task {task_id} to {stage_id}: {name}'

    @tool
    def connect_stages(source_stage_id: str, target_stage_id: str) -> str:
        """
        Create a dependency edge so source runs before target. Call once per
        stage transition to define the pipeline flow.

        Args:
            source_stage_id: The upstream stage id.
            target_stage_id: The downstream stage id that depends on it.

        Returns:
            Confirmation message.
        """
        if source_stage_id != target_stage_id:
            edge = {'source': source_stage_id, 'target': target_stage_id}
            if edge not in state['edges']:
                state['edges'].append(edge)
        return f'Connected {source_stage_id} -> {target_stage_id}'

    return [set_pipeline_name, add_stage, add_task, connect_stages]
