# AgentOS User Guide & Presentation Handout

This document acts as a user manual for operating AgentOS, registering tool environments, running simulations in the Playground, and analyzing trace timelines. It also contains presentation slide summaries.

---

## 1. Quick Start Installation

Follow these steps to run AgentOS on your local environment:

### Prerequisites
- Docker & Docker Compose
- Node.js (v18+)
- Ollama (installed on host machine)

### Configuration
1. Initialize the backend environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Verify model availability in Ollama:
   ```bash
   ollama pull llama3
   ollama run llama3 "Hello!"
   ```

### Execution
Start the container infrastructure:
```bash
docker-compose up --build -d
```
The application will launch on:
- **Frontend Panel**: `http://localhost:3000`
- **REST API Gateway**: `http://localhost:3001`

---

## 2. Navigating the Control Plane Features

### 🌟 Dashboard Panel
Provides aggregated operations telemetry at a single glance:
- **Active Agents Count**: The number of deployed nodes in `active` status.
- **Success Rate Metrics**: Tracks percentage outcomes for the last 1000 runs.
- **Token Usage & Est. Cost Calculations**: Live tracking of token volume and billing costs.
- **Recent Executions Log**: Clickable logs indicating latency, cost, and model types.

### ⬡ Agent Lifecycle Management
- **Design Spec**: Define an agent's name, prompt template instruction rules, and target model (e.g. `llama3`).
- **Version Iteration**: Every spec modification creates a new unmutable version number (e.g. `v1 -> v2`).
- **One-Click Deployments**: Click `Deploy` to transition a version to `production` or `staging` environment.

### ⚙️ Extensible Tools Registry
Enhance agents with custom tools. Supports two standard protocol architectures:
1. **Model Context Protocol (MCP)**: A JSON-RPC standard allowing agents to safely query database systems, browser contexts, or file directories.
2. **REST Webhooks**: Standard HTTP JSON endpoints for REST service queries.

---

## 3. Simulating in the Agent Playground

The **Playground** is an interactive console to test prompt inputs against active agents and watch execution logs stream live.

### Testing a Multi-Agent Delegation Scenario
1. Go to the **Playground** screen.
2. Select an active agent (e.g., `ResearchAgent` powered by `llama3`).
3. Enter your prompt context, for example:
   > *"Search the web for the latest developments in Advanced Agentic Coding, delegate the findings to CustomWriter to write a structured summary, and compile it."*
4. Click `Send`. The agent will trigger reasoning chains, run the `web-search` tool, and delegation rules dynamically.

---

## 4. Deep-Dive Observability: Distributed Spans Tree

When the execution finishes:
1. Click the execution row inside the **Playground Logs** or **Recent Executions** table.
2. Navigating to the **Observability Trace Tree** tab displays a nested Gantt-style trace timeline:
   - Inspect exactly how long each phase took (e.g., reasoning vs. search tool execution vs. writer sub-agent invocation).
   - Click any span row to expand input prompt variables and returned raw JSON data payloads.

---

## 5. Presentation Handout: User Guide Slide Highlights

*Copy these key talking points into your slide deck:*

*   **Version Control for LLM Prompts**: Prompts are treated as source code. AgentOS tags prompt configurations with immutable version states, allowing safe rollbacks without downtime.
*   **Protocol-Agnostic Tool Integration**: Bridges the gap between old-world APIs (REST webhooks) and modern stateful interfaces (MCP servers) in a unified database tool registry.
*   **Jaeger-Style Telemetry**: Turns black-box LLM systems into transparent pipelines. You can inspect precisely where latency accumulates, what inputs were supplied to tools, and the output payloads.
*   **Cost & Token Guardrails**: Real-time evaluation of LLM spend metrics on the Dashboard prevents uncontrolled agent loops or billing surprises.
