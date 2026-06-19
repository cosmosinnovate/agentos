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
        with urllib.request.urlopen(req, data=body, timeout=90) as response:
            if response.status == 204:
                return {}, 204
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

def register_tool(name, description, endpoint):
    config = {}
    local_mcp_url = endpoint.replace("host.docker.internal", "localhost").replace("127.0.0.1", "localhost")
    try:
        req = urllib.request.Request(f"{local_mcp_url}/tools", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for t in data.get("tools", []):
                if t.get("name") == name:
                    config = {"inputSchema": t.get("inputSchema", {})}
                    if t.get("description"):
                        description = t.get("description")
                    print(f"ℹ️ Found live schema for '{name}' on local MCP server.")
                    break
    except Exception as e:
        print(f"⚠️ Could not fetch tool schema from MCP server at {local_mcp_url}/tools: {e}")
        if name == "local-weather":
            config = {
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city name or location query (e.g. Seattle, Tokyo, San Francisco)"
                        }
                    },
                    "required": ["location"]
                }
            }

    tool_payload = {
        "name": name,
        "description": description,
        "protocol": "MCP",
        "endpoint": endpoint,
        "config": config
    }
    
    # Check if tool already exists
    list_tools, _ = make_request(f"{BACKEND_URL}/tools")
    if isinstance(list_tools, list):
        for t in list_tools:
            if isinstance(t, dict) and t.get("name") == name:
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
        "owner": "weather-team"
    }
    
    # Check if agent already exists
    list_agents, _ = make_request(f"{BACKEND_URL}/agents")
    if isinstance(list_agents, list):
        for a in list_agents:
            if isinstance(a, dict) and a.get("name") == name:
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
        "changelog": "Initial deployment linking local-weather MCP tool"
    }
    res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/versions", "POST", version_payload)
    if status in (200, 201):
        print("✅ Uploaded YAML definition successfully.")
        return True
    else:
        print(f"❌ Failed to upload YAML definition: {res}")
        return False

def main():
    parser = argparse.ArgumentParser(description="AgentOS local weather agent runner")
    parser.add_argument(
        "--config",
        type=str,
        default="weather-agent.yaml",
        help="Path to the weather agent YAML configuration"
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default="What is the weather in Seattle?",
        help="The query prompt to ask the weather agent"
    )
    args = parser.parse_args()

    print("==========================================================")
    print("🌤️ AgentOS Local Weather Assistant Demo")
    print("==========================================================")

    ollama_ok = is_ollama_running()
    
    # Read YAML definition
    script_dir = os.path.dirname(os.path.abspath(__file__))
    yaml_path = args.config if os.path.isabs(args.config) else os.path.join(script_dir, args.config)
    
    try:
        with open(yaml_path, "r") as f:
            agent_yaml = f.read()
    except FileNotFoundError:
        print(f"❌ YAML configuration file not found at: {yaml_path}")
        return

    # Parse metadata dynamically
    agent_name, agent_desc = extract_metadata_from_yaml(agent_yaml)
    
    if not ollama_ok:
        print("⚠️ Ollama is NOT detected running locally on http://localhost:11434.")
        print("   Modifying YAML definition dynamically to use 'mock' provider.")
        agent_yaml = agent_yaml.replace("provider: ollama", "provider: mock")
    else:
        print("✅ Ollama detected running locally.")

    # 1. Register the local-weather MCP tool
    tool_id = register_tool(
        "local-weather",
        "Retrieve real-time local weather forecasts (temperature, conditions, wind, humidity) for a given city.",
        "http://host.docker.internal:8088"
    )
    if not tool_id:
        return

    # 2. Register the weather assistant agent
    agent_id = register_agent(agent_name, agent_desc)
    if not agent_id:
        return

    # 3. Upload the YAML version definition
    if not upload_yaml_definition(agent_id, agent_yaml):
        return

    # 4. Invoke the agent to run the query
    print(f"\n--- Invoking Weather Agent '{agent_name}' ---")
    print(f"Query: \"{args.prompt}\"")
    
    invoke_payload = {
        "message": args.prompt
    }
    
    res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/invoke", "POST", invoke_payload)
    if status in (200, 201):
        print("\n🎉 Invocation Successful!")
        print("----------------------------------------------------------")
        print(f"Response:\n{res.get('result')}")
        print("----------------------------------------------------------")
        print("\n🔍 Trace & Telemetry Details:")
        trace = res.get("trace", {})
        print(f"  Trace ID: {trace.get('traceId')}")
        print(f"  Latency: {trace.get('latencyMs')}ms")
        print(f"  Cost: ${trace.get('estimatedCostUsd')} USD")
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
