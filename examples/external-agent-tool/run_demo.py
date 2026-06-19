import os
import json
import urllib.request
import urllib.error
import argparse
import re
import time

BACKEND_URL = "http://localhost:3001/api/v1"

def make_request(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    
    body = None
    if data:
        body = json.dumps(data).encode("utf-8")
        
    try:
        with urllib.request.urlopen(req, data=body, timeout=90) as response:
            if response.status == 204:
                return {}, 204
            content = response.read().decode("utf-8").strip()
            if not content:
                return {}, response.status
            return json.loads(content), response.status
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

def register_tool(name, description, endpoint):
    tool_payload = {
        "name": name,
        "description": description,
        "protocol": "REST",
        "endpoint": endpoint
    }
    
    # Check if tool already exists
    list_tools, _ = make_request(f"{BACKEND_URL}/tools")
    for t in list_tools:
        if t["name"] == name:
            print(f"ℹ️ Existing tool '{name}' found. Re-registering to update endpoint...")
            make_request(f"{BACKEND_URL}/tools/{t['id']}", "DELETE")
            
    res, status = make_request(f"{BACKEND_URL}/tools", "POST", tool_payload)
    if status in (200, 201):
        print(f"✅ Tool '{name}' registered successfully.")
        return res["id"]
    else:
        print(f"❌ Failed to register tool '{name}': {res}")
        return None

def register_agent(name, description):
    agent_payload = {
        "name": name,
        "description": description,
        "owner": "delegation-team"
    }
    
    # Check if agent already exists
    list_agents, _ = make_request(f"{BACKEND_URL}/agents")
    for a in list_agents:
        if a["name"] == name:
            print(f"ℹ️ Agent '{name}' is already registered.")
            return a["id"]
            
    res, status = make_request(f"{BACKEND_URL}/agents", "POST", agent_payload)
    if status in (200, 201):
        print(f"✅ Agent '{name}' registered successfully.")
        return res["id"]
    else:
        print(f"❌ Failed to register agent '{name}': {res}")
        return None

def upload_yaml_definition(agent_id, yaml_content):
    version_payload = {
        "definition": yaml_content,
        "changelog": "Link external Python agent as REST tool"
    }
    res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/versions", "POST", version_payload)
    if status in (200, 201):
        print("✅ Uploaded YAML definition successfully.")
        return True
    else:
        print(f"❌ Failed to upload YAML definition: {res}")
        return False

def main():
    print("==========================================================")
    print("🤖 AgentOS Pattern 2: External Agent Delegation Demo")
    print("==========================================================")

    # Read YAML definition
    script_dir = os.path.dirname(os.path.abspath(__file__))
    yaml_path = os.path.join(script_dir, "orchestrator-agent.yaml")
    
    try:
        with open(yaml_path, "r") as f:
            agent_yaml = f.read()
    except FileNotFoundError:
        print(f"❌ YAML configuration file not found at: {yaml_path}")
        return

    agent_name, agent_desc = extract_metadata_from_yaml(agent_yaml)

    # 1. Register the external REST agent as a tool
    tool_id = register_tool(
        "external-summarizer",
        "Delegates complex text summarizations to an external Python agent server.",
        "http://host.docker.internal:8089"
    )
    if not tool_id:
        return

    # 2. Register the orchestrator agent
    agent_id = register_agent(agent_name, agent_desc)
    if not agent_id:
        return

    # 3. Upload the YAML version definition
    if not upload_yaml_definition(agent_id, agent_yaml):
        return

    # 4. Invoke the agent
    prompt = "Read about AI Agent Control Planes and compile a detailed summary using external summarizer."
    print(f"\n--- Invoking Orchestrator Agent '{agent_name}' ---")
    print(f"Query: \"{prompt}\"")
    
    invoke_payload = {
        "message": prompt
    }
    
    res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/invoke", "POST", invoke_payload)
    if status in (200, 201):
        print("\n🎉 Invocation Successful!")
        print("----------------------------------------------------------")
        print(f"Response:\n{res.get('result')}")
        print("----------------------------------------------------------")
        print("\n🔍 Observability Spans & Telemetry:")
        trace = res.get("trace", {})
        print(f"  Trace ID: {trace.get('traceId')}")
        print(f"  Total Latency: {trace.get('latencyMs')}ms")
        print("  Telemetry Spans:")
        for span in trace.get("spans", []):
            print(f"    - [{span.get('type')}] {span.get('name')} (Took {span.get('latencyMs')}ms)")
    else:
        print(f"\n❌ Invocation failed: {res}")

    print("\n==========================================================")
    print("✨ Demo execution finished!")
    print("==========================================================")

if __name__ == "__main__":
    main()
