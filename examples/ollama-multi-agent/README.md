# Tutorial: Testing Local Multi-Agent Workflows with Ollama in AgentOS

This guide explains how to showcase and test a local multi-agent setup (Orchestrator + Sub-agent) running entirely on your machine using Ollama and AgentOS.

---

## 📋 Prerequisites

Ensure you have the following installed and running:
1. **Ollama**: Download and start the application from [ollama.com](https://ollama.com).
2. **Llama3 Model**: Download the model locally:
   ```bash
   ollama run llama3
   ```
3. **AgentOS Services**: Verify that the database, NestJS API, and Next.js UI are active.

---

## 🚀 Step-by-Step Walkthrough

### Step 1: Start AgentOS
In the root directory, ensure the frontend and backend servers are running:
- **Backend (API)**: `http://localhost:3001`
- **Frontend (Studio UI)**: `http://localhost:3000`

### Step 2: Register & Run the Example
Run the automated script to register the agents and trigger the first execution:
```bash
python3 examples/ollama-multi-agent/run_demo.py
```
This script will:
- Check if Ollama is accessible at `http://localhost:11434`.
- Read and upload the YAML manifests for both `custom-writer` and `research-orchestrator`.
- Trigger a synchronous test invocation on the orchestrator.

### Step 3: Verify in Agent Studio (UI)
Open your browser and navigate to **[Agent Studio Dashboard](http://localhost:3000)**:

1. **Check Registered Agents**:
   - Go to the **Agents** tab on the sidebar.
   - You should see `custom-writer` and `research-orchestrator` registered.
   - Click on `research-orchestrator` to inspect its current active YAML version, showing `provider: ollama` and `model: llama3`.

2. **Inspect the Execution Trace**:
   - Click on the **Dashboard** or **Deployments** view to see the live metrics updating.
   - Scroll to **Recent Executions** and click on the latest execution for `research-orchestrator`.
   - Inspect the logs: you will see the exact latency, model name (`ollama/llama3`), token count, and simulated cost.

### Step 4: Run Interactive Tests in the Playground
To demonstrate interactive invocation:
1. Go to the **Playground** tab on the sidebar.
2. Select the **research-orchestrator** agent from the dropdown.
3. In the **Context / System Prompt Override** field, enter:
   ```json
   "Sub-agent custom-writer ID is [PASTE_WRITER_UUID_HERE]"
   ```
   *(You can copy the writer UUID from the Agents list).*
4. Type a message in the chat box, e.g.:
   ```text
   Research the advantages of TypeScript over JavaScript and write a summary.
   ```
5. Click **Send** and watch the execution response load dynamically.
