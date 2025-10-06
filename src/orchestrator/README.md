# Layer 2: Orchestrator

The Orchestrator manages multi-step workflows with role-based task distribution. It coordinates complex operations by using the CLI layer for individual steps while managing workflow state and context.

## Architecture

```
Layer 2 (Orchestrator) - Multi-step Workflows & Role Distribution
    ↓ Uses
Layer 1 (CLI) - Individual Query Processing & Tool Execution
```

## Key Components

- **`orchestrator-server.ts`**: HTTP API server for workflow orchestration
- **`sequential-workflow-orchestrator.ts`**: Core sequential workflow management
- **`intelligent-task-orchestrator.ts`**: AI-driven task orchestration
- **`workflow-definitions.ts`**: Predefined workflow templates
- **`context-manager.ts`**: Context management across workflow steps
- **`tool-management-api.ts`**: Tool selection and execution APIs

## Features

- **Sequential Workflows**: Execute multi-step processes in order
- **Role-Based Distribution**: Assign tasks to specialized AI agents
- **Context Passing**: Maintain context between workflow steps
- **Cross-Step Learning**: Aggregate results from multiple steps
- **Pause/Resume**: Workflow state management and rollback capabilities
- **Redis Integration**: Message queuing and state persistence

## Usage

The orchestrator receives complex requests and breaks them down into individual CLI operations, managing the overall workflow while each step benefits from the full semantic analysis pipeline.