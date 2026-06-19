import os
import json
import urllib.request
import urllib.error
import argparse
import re

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

def extract_metadata_from_yaml(yaml_content):
    metadata_block = re.search(r'metadata:\s*\n((?:\s+.+\n?)*)', yaml_content)
    name = "anonymous-agent"
    desc = "An agent managed by AgentOS"
    if metadata_block:
        lines = metadata_block.group(1).split('\n')
        for line in lines:
            if 'name:' in line:
                name = line.split('name:')[1].strip().strip('"\'')
            elif 'description:' in line:
                desc = line.split('description:')[1].strip().strip('"\'')
    return name, desc

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
    parser = argparse.ArgumentParser(description="AgentOS local multi-agent Ollama demo runner")
    parser.add_argument(
        "--writer",
        type=str,
        default="custom-writer.yaml",
        help="Path or name of the writer agent YAML definition"
    )
    parser.add_argument(
        "--orchestrator",
        type=str,
        default="research-orchestrator.yaml",
        help="Path or name of the orchestrator agent YAML definition"
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default="Research the benefits of container orchestrations and write a summary.",
        help="Prompt query message to invoke the orchestrator agent with"
    )
    args = parser.parse_args()

    print("==========================================================")
    print("AgentOS local multi-agent Ollama demo runner")
    print("==========================================================")
    
    ollama_ok = is_ollama_running()
    
    # Read YAML definitions dynamically
    script_dir = os.path.dirname(os.path.abspath(__file__))
    writer_yaml_path = args.writer if os.path.isabs(args.writer) else os.path.join(script_dir, args.writer)
    orchestrator_yaml_path = args.orchestrator if os.path.isabs(args.orchestrator) else os.path.join(script_dir, args.orchestrator)
    
    try:
        with open(writer_yaml_path, "r") as f:
            writer_yaml = f.read()
    except FileNotFoundError:
        print(f"❌ Writer YAML definition not found at: {writer_yaml_path}")
        return
        
    try:
        with open(orchestrator_yaml_path, "r") as f:
            orchestrator_yaml = f.read()
    except FileNotFoundError:
        print(f"❌ Orchestrator YAML definition not found at: {orchestrator_yaml_path}")
        return

    # Parse metadata dynamically
    writer_name, writer_desc = extract_metadata_from_yaml(writer_yaml)
    orchestrator_name, orchestrator_desc = extract_metadata_from_yaml(orchestrator_yaml)
        
    if not ollama_ok:
        print("⚠️ Ollama is NOT detected running locally on http://localhost:11434.")
        print("   Modifying YAML definitions dynamically to use 'mock' provider.")
        writer_yaml = writer_yaml.replace("provider: ollama", "provider: mock")
        orchestrator_yaml = orchestrator_yaml.replace("provider: ollama", "provider: mock")
    else:
        print("✅ Ollama detected running locally.")

    # 1. Register writer sub-agent dynamically
    print(f"\nRegistering agent '{writer_name}'...")
    writer_id = register_agent(writer_name, writer_desc)
    if writer_id:
        upload_yaml_definition(writer_id, writer_yaml)

    # 2. Register orchestrator sub-agent dynamically
    print(f"\nRegistering agent '{orchestrator_name}'...")
    orchestrator_id = register_agent(orchestrator_name, orchestrator_desc)
    if orchestrator_id:
        upload_yaml_definition(orchestrator_id, orchestrator_yaml)

    if not writer_id or not orchestrator_id:
        return

    # 3. Invoke orchestrator
    print(f"\n--- Invoking Orchestrator Agent '{orchestrator_name}' ---")
    prompt = args.prompt
    
    invoke_data = {
        "message": prompt,
        "context": f"Sub-agent {writer_name} ID is {writer_id}."
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
