import os
import json
import urllib.request
import urllib.error

BACKEND_URL = "http://localhost:3001/api/v1"
OLLAMA_URL = "http://localhost:11434"

def make_request(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    
    body = None
    if data:
        body = json.dumps(data).encode("utf-8")
        
    try:
        # Set a 5-second timeout to prevent infinite hanging
        with urllib.request.urlopen(req, data=body, timeout=5) as response:
            return json.loads(response.read().decode("utf-8")), response.status
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        try:
            return json.loads(err_msg), e.code
        except Exception:
            return {"error": err_msg}, e.code
    except urllib.error.URLError as e:
        return {"error": str(e.reason)}, 503
    except Exception as e:
        return {"error": str(e)}, 500

def is_ollama_running():
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=2) as response:
            return response.status == 200
    except Exception:
        return False

def register_agent(name, description):
    agent_data = {
        "name": name,
        "description": description,
        "owner": "team@agentos.io"
    }
    res, status = make_request(f"{BACKEND_URL}/agents", "POST", agent_data)
    if status in (200, 201):
        print(f"✅ Registered agent '{name}' successfully.")
        return res["id"]
    else:
        # Check if already registered
        list_res, _ = make_request(f"{BACKEND_URL}/agents")
        for agent in list_res:
            if agent["name"] == name:
                print(f"ℹ️ Agent '{name}' is already registered.")
                return agent["id"]
        print(f"❌ Failed to register agent '{name}': {res}")
        return None

def upload_yaml_definition(agent_id, yaml_content):
    version_data = {
        "definition": yaml_content,
        "changelog": "Loaded from examples directory"
    }
    res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/versions", "POST", version_data)
    if status in (200, 201):
        print("✅ Uploaded YAML definition.")
        return True
    else:
        print(f"❌ Failed to upload YAML: {res}")
        return False

def main():
    print("==========================================================")
    print("AgentOS local multi-agent Ollama demo runner")
    print("==========================================================")
    
    ollama_ok = is_ollama_running()
    
    # Read YAML definitions
    script_dir = os.path.dirname(os.path.abspath(__file__))
    writer_yaml_path = os.path.join(script_dir, "custom-writer.yaml")
    orchestrator_yaml_path = os.path.join(script_dir, "research-orchestrator.yaml")
    
    with open(writer_yaml_path, "r") as f:
        writer_yaml = f.read()
        
    with open(orchestrator_yaml_path, "r") as f:
        orchestrator_yaml = f.read()
        
    if not ollama_ok:
        print("⚠️ Ollama is NOT detected running locally on http://localhost:11434.")
        print("   Modifying YAML definitions dynamically to use 'mock' provider.")
        writer_yaml = writer_yaml.replace("provider: ollama", "provider: mock")
        orchestrator_yaml = orchestrator_yaml.replace("provider: ollama", "provider: mock")
    else:
        print("✅ Ollama detected running locally.")

    # 1. Register custom-writer sub-agent
    writer_id = register_agent("custom-writer", "Drafts and polishes content articles")
    if writer_id:
        upload_yaml_definition(writer_id, writer_yaml)

    # 2. Register research-orchestrator
    orchestrator_id = register_agent("research-orchestrator", "Coordinates research and delegates drafting tasks to sub-agents")
    if orchestrator_id:
        upload_yaml_definition(orchestrator_id, orchestrator_yaml)

    if not writer_id or not orchestrator_id:
        return

    # 3. Invoke orchestrator
    print("\n--- Invoking Research Orchestrator ---")
    prompt = "Research the benefits of container orchestrations and write a summary."
    
    invoke_data = {
        "message": prompt,
        "context": f"Sub-agent custom-writer ID is {writer_id}."
    }
    
    print("Invoking orchestrator...")
    # Long timeout (60s) for Ollama inference latency
    req = urllib.request.Request(f"{BACKEND_URL}/agents/{orchestrator_id}/invoke", method="POST")
    req.add_header("Content-Type", "application/json")
    body = json.dumps(invoke_data).encode("utf-8")
    
    try:
        with urllib.request.urlopen(req, data=body, timeout=60) as response:
            res = json.loads(response.read().decode("utf-8"))
            print("\n✅ Execution Successful!")
            print("-----------------------")
            print(f"Orchestrator Result:\n{res.get('result')}")
            print("\nTrace Log:")
            print(json.dumps(res.get("trace"), indent=2))
    except Exception as e:
        print(f"\n❌ Invocation timed out or failed: {e}")

if __name__ == "__main__":
    main()
