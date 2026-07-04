# AgentOS Examples & Demo Runner

This directory contains example configurations, tools, and scripts demonstrating the core capabilities of AgentOS.

---

## 🚀 The Reusable Demo Runner (`run_demo.py`)

Rather than maintaining custom scripts for every single scenario, you can use the generic **[`run_demo.py`](run_demo.py)** script. It can dynamically:
1. **Register MCP Tools** to the control plane, including auto-resolving schemas from active local servers.
2. **Register Agents** and upload their YAML version definitions.
3. **Handle Multi-Agent Variable Injection**: Substitute registered agent IDs directly into prompt and context variables using `{agent_name}` placeholders.
4. **Trigger Executions**: Call the backend's `/invoke` endpoint to execute prompts and display Gantt trace details.
5. **Teardown Resources**: Automatically clean up registered tools and agents after execution using cascading deletes with the `--cleanup` flag.
6. **Handle Local LLMs**: Auto-detect if Ollama is running and gracefully fall back to `mock` mode if it is not.

---

## 📁 Examples Overview

*   **[`ollama-single-agent/`](ollama-single-agent/)**: Single agent setup running a `weather-assistant` powered by local `llama3`.
*   **[`ollama-multi-agent/`](ollama-multi-agent/)**: Multi-agent delegation where a `research-orchestrator` dynamically passes tasks to a `custom-writer` sub-agent.
*   **[`local-weather-mcp/`](local-weather-mcp/)**: A Model Context Protocol (MCP) server written in Node.js that exposes local weather query capabilities.
*   **[`local-flights-mcp/`](local-flights-mcp/)**: An MCP server written in Node.js that simulates flight searches and details.
*   **[`mcp-dynamic-demo/`](mcp-dynamic-demo/)**: Legacy script showing manual cascading resource deletion flow.

---

## 🏃 Running the Examples

### 1. Local Weather Assistant (Single Agent + MCP Tool)
This example registers the `local-weather` tool, deploys the `weather-assistant` agent, and queries the weather.

1. Start the local weather MCP server (default port `8088`):
   ```bash
   node examples/local-weather-mcp/mcp-server.js
   ```
2. Execute the runner script:
   ```bash
   python3 examples/run_demo.py \
     --tools "local-weather:http://host.docker.internal:8088" \
     --agents examples/ollama-single-agent/weather-agent.yaml \
     --prompt "What is the weather in Seattle?"
   ```

### 2. Multi-Agent Delegation (Orchestrator + Writer)
This registers both the `custom-writer` and `research-orchestrator` agents. It dynamically replaces the `{custom-writer}` placeholder in the orchestrator's context with the actual UUID returned from registration, facilitating routing.

```bash
python3 examples/run_demo.py \
  --agents examples/ollama-single-agent/custom-writer.yaml examples/ollama-multi-agent/research-orchestrator.yaml \
  --invoke "research-orchestrator" \
  --prompt "Research the benefits of container orchestrations and write a summary." \
  --context "Sub-agent custom-writer ID is {custom-writer}."
```

### 3. Cleaning Up Deployed Resources
If you want to run a quick test and delete the registered tools/agents from the Postgres control plane database immediately afterward, add the `--cleanup` flag:

```bash
python3 examples/run_demo.py \
  --tools "local-weather:http://host.docker.internal:8088" \
  --agents examples/ollama-single-agent/weather-agent.yaml \
  --prompt "What is the weather in San Francisco?" \
  --cleanup
```

---

## 🛠️ CLI Options Reference

| CLI Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--backend-url` | string | `http://localhost:3001/api/v1` | Root gateway endpoint of the AgentOS backend. |
| `--ollama-url` | string | `http://localhost:11434` | Endpoint of the Ollama server. |
| `--tools` | space-separated list | `[]` | MCP tools to register, formatted as `name:endpoint[:description]`. |
| `--agents` | space-separated list | (Required) | File paths to agent YAML definitions. |
| `--invoke` | string | Last registered agent | Name of the agent to query/invoke. |
| `--prompt` | string | `Hello!` | Query string to send to the target agent. |
| `--context` | string | `""` | Key-value/System override instruction context (supports `{agent_name}` variables). |
| `--cleanup` | flag | `False` | Deletes registered agents and tools from the DB after the run. |
