# AgentOS: Enterprise AI Agent Control Plane

AgentOS is a centralized control plane designed to build, version, deploy, observe, scale, and secure AI agents. Operating like a "Kubernetes or Vercel for AI Agents," it abstracts infrastructure setup and standardizes operational practices for multi-agent workflows.

---

## 🏗️ Repository Architecture

The repository is structured as a monorepo containing the following components:

*   **[`backend/`](backend)**: A NestJS application that handles agent lifecycle configuration, execution logs, distributed span tracking, and tool orchestration.
*   **[`frontend/`](frontend)**: A Next.js (React 19) Agent Studio dashboard featuring an interactive playground, live observability trace trees, and credential management settings.
*   **[`examples/`](examples/README.md)**: Pre-configured agent configurations, Model Context Protocol (MCP) servers, and the [generic examples runner](examples/README.md#-the-reusable-demo-runner-run_demopy).

---

## 📚 Documentation

Detailed design blueprints, specifications, and guides are available in the [`docs/`](docs) directory:

*   **[Architecture Design](docs/architecture.md)**: System topology, component interactions, request lifecycles, and trace hierarchies.
*   **[User Guide & Presentation Handout](docs/user_guide.md)**: Manual for operating AgentOS, simulating multi-agent delegation, and analyzing telemetry.
*   **[API Documentation](docs/api_documentation.md)**: REST API schema reference for agent control plane resources.
*   **[State and Memory Design Spec](docs/state_and_memory_spec.md)**: High-level requirements and specifications for persisting context/memory.
*   **[State and Memory Design](docs/state_and_memory_design.md)**: Implementation details, design choices, and flow diagrams for database-backed agent state.
*   **[Moat Analysis](docs/moat_analysis.md)**: Competitive advantages, security boundaries, and architectural defensibility analysis.

---


## 🛠️ Prerequisites

Ensure you have the following installed on your machine:
- **Docker** and **Docker Compose**
- **Node.js** (v18+ recommended, for local manual running)
- **Ollama** (optional, for running local models on host CPU/GPU)

---

## 🚀 Quick Start (Docker Compose)

The fastest way to spin up the entire stack (PostgreSQL database, NestJS backend, and Next.js frontend) is using Docker Compose.

### 1. Configure the Backend Environment
Copy the example environment file in the backend directory:
```bash
cp backend/.env.example backend/.env
```
*(By default, missing model provider credentials in the backend will fall back to **Mock Mode**, allowing you to explore the dashboard immediately without inputting real API keys).*

### 2. Boot the Application
Run the following command at the root of the repository:
```bash
docker compose up --build -d
```
Docker will pull the images, verify container health, and expose the services:
*   **Agent Studio Web Console (Frontend)**: [http://localhost:3000](http://localhost:3000)
*   **Control Plane Gateway (Backend REST API)**: [http://localhost:3001](http://localhost:3001)
*   **PostgreSQL Database**: `localhost:5432`

---

## 💻 Manual Local Development

If you prefer to run services individually outside of Docker container runtimes:

### 1. PostgreSQL Database
Ensure you have a PostgreSQL server running locally, and create a database named `agentos`.
Update the database connection details in `backend/.env`.

### 2. Set Up the Backend (NestJS)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the NestJS development server in watch mode:
   ```bash
   npm run start:dev
   ```
   *Note: On startup, TypeORM will automatically synchronize and provision the database schema tables.*

### 3. Set Up the Frontend (Next.js)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the public API endpoint inside `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

---

## 🔌 Integrating LLM Providers & API Keys

AgentOS supports both host-configured environment variables and database-backed encrypted credentials.

### Database Credentials (UI Settings)
Inside the **Agent Studio UI**, navigate to the **Tools** page. Here, you can configure credentials for providers like OpenAI, Anthropic, Gemini, or GCP. These are:
1. Encrypted using AES-256-CBC with the backend's `ENCRYPTION_KEY`.
2. Stored securely in PostgreSQL.
3. Automatically loaded during agent executions.

### Fallback Environment Variables
Alternatively, you can provide global credentials inside `backend/.env` under:
*   `OPENAI_API_KEY`
*   `ANTHROPIC_API_KEY`
*   `GCP_PROJECT_ID`
*   `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`

---

## 🦙 Running Local LLMs (Ollama)

To run agents on local hardware using Ollama:
1. Install [Ollama](https://ollama.com) on your host machine.
2. Download and test your target model (e.g. `llama3`):
   ```bash
   ollama pull llama3
   ollama run llama3 "Hello!"
   ```
3. The Docker Compose file maps backend calls to the host network bridge via `http://host.docker.internal:11434`, enabling seamless local inference.

---

## 🧪 Running Tests

### Backend Unit & Integration Tests
Navigate to `backend` and run:
```bash
npm run test
```
To check test coverage:
```bash
npm run test:cov
```
