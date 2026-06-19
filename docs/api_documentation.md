# AgentOS API Documentation & Interactive REST UI

AgentOS provides a fully-featured, interactive **Swagger / OpenAPI REST UI** built directly into the Control Plane backend. You can use it to view endpoint schemas, execute direct API test queries, and verify JSON structures.

---

## 📚 Accessing the Interactive REST UI
When the AgentOS Docker Compose environment is running, access the interactive testing interface at:

👉 **[http://localhost:3001/api/docs](http://localhost:3001/api/docs)**

### Features of the REST UI:
1. **Interactive Testing**: Click **"Try it out"** on any endpoint, populate parameters, and click **"Execute"** to send live API calls.
2. **Schema Inspection**: Expand the **Schemas** section at the bottom of the page to inspect DTO validation rules (e.g. string lengths, required fields, and type annotations).
3. **CURL Generators**: Whenever you execute a query via the UI, it prints the matching `curl` command so you can run it directly in your terminal.

---

## 🛠️ API Reference & Endpoint Details

### 1. Agents Module (`/api/v1/agents`)
Handles agent creation, configuration uploading (YAML versions), and conversational execution invocation.

*   `POST /api/v1/agents`: Register a new agent.
    *   *Payload:* `{"name": "agent-kebab-case", "description": "text", "owner": "text"}`
*   `GET /api/v1/agents`: List all registered agents.
*   `GET /api/v1/agents/{id}`: Fetch detailed metadata of a specific agent.
*   `POST /api/v1/agents/{id}/versions`: Upload a new YAML version definition (updates tools links, model targets, etc.).
    *   *Payload:* `{"definition": "YAML text...", "changelog": "Changelog text"}`
*   `GET /api/v1/agents/{id}/versions`: List version histories for the agent.
*   `POST /api/v1/agents/{id}/invoke`: Invoke the agent's ReAct reasoning execution loop.
    *   *Payload:* `{"message": "user prompt", "context": "optional system overrides"}`

---

### 2. Tool Registry Module (`/api/v1/tools`)
Manages tools linking to external REST APIs or Model Context Protocol (MCP) servers.

*   `POST /api/v1/tools`: Register a tool environment.
    *   *Payload:*
        ```json
        {
          "name": "tool-name",
          "description": "Used by the LLM to understand when to invoke it.",
          "protocol": "REST", 
          "endpoint": "http://host.docker.internal:8089"
        }
        ```
*   `GET /api/v1/tools`: List all registered tools.
*   `DELETE /api/v1/tools/{id}`: Delete a tool environment.

---

### 3. Deployments Module (`/api/v1/deployments`)
Deploys agent versions to stages (`staging`, `production`) locally or in the cloud.

*   `POST /api/v1/agents/{id}/deploy`: Deploy an agent version.
    *   *Payload:* `{"environment": "production", "versionNumber": 1}`
    *   *Response Endpoint:* Returns a fully functional invocation proxy URL pointing back to the Control Plane: `http://localhost:3001/api/v1/agents/{agentId}/invoke`
*   `POST /api/v1/agents/{id}/rollback`: Rollback an active deployment to a previous version configuration.
    *   *Payload:* `{"environment": "production", "versionNumber": 1}`
*   `GET /api/v1/agents/{id}/deployments`: Fetch deployment history for the agent.

---

### 4. Observability & Telemetry Module (`/api/v1/executions`)
Ingests and aggregates Jaegar-style span trace trees, cost tracking, and latency details.

*   `GET /api/v1/executions`: List recent executions across all agents.
*   `GET /api/v1/executions/{id}`: Fetch full trace detail payload (including nested spans Gantt timeline arrays).
*   `GET /api/v1/executions/metrics`: Fetch global cost and success rate observability aggregates.

---

## 💻 Terminal Command Examples (CURL)

### A. Deploying an Agent Version
To deploy the production environment for an agent:
```bash
curl -X POST http://localhost:3001/api/v1/agents/YOUR-AGENT-UUID/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "production",
    "versionNumber": 1
  }'
```

### B. Invoking the Agent Directly
To trigger the dynamic ReAct execution loop:
```bash
curl -X POST http://localhost:3001/api/v1/agents/YOUR-AGENT-UUID/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the weather in Paris?",
    "context": "Assume metric units if not specified."
  }'
```
