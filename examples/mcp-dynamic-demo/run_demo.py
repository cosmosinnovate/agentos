import os
import json
import urllib.request
import urllib.error
import time
import argparse
import re

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

def main():
    parser = argparse.ArgumentParser(description="AgentOS Dynamic Tool & Agent Lifecycle Demo")
    parser.add_argument(
        "--agent-config",
        type=str,
        default="examples/local-weather-mcp/weather-agent.yaml",
        help="Path to the agent YAML configuration file"
    )
    parser.add_argument(
        "--tool-name",
        type=str,
        default="local-weather",
        help="Name of the MCP tool to register"
    )
    parser.add_argument(
        "--tool-desc",
        type=str,
        default="Retrieve real-time local weather forecasts (temperature, conditions) for a given city.",
        help="Description of the MCP tool"
    )
    parser.add_argument(
        "--tool-endpoint",
        type=str,
        default="http://localhost:8088",
        help="Endpoint URL of the MCP tool server"
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default="What is the weather in Seattle?",
        help="Query prompt to invoke the agent with"
    )
    args = parser.parse_args()

    print("==========================================================")
    print("🚀 AgentOS Dynamic Tool & Agent Lifecycle Demo")
    print("==========================================================")

    # Resolve agent YAML configuration
    script_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    # Resolve relative to project root or absolute
    yaml_path = args.agent_config if os.path.isabs(args.agent_config) else os.path.join(script_dir, args.agent_config)
    
    try:
        with open(yaml_path, "r") as f:
            agent_yaml = f.read()
    except FileNotFoundError:
        # Retry local path relative to script directory
        script_local = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.agent_config)
        try:
            with open(script_local, "r") as f:
                agent_yaml = f.read()
        except FileNotFoundError:
            # Last fallback: search for weather-agent.yaml relative to script dir
            fallback_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "local-weather-mcp", "weather-agent.yaml")
            try:
                with open(fallback_path, "r") as f:
                    agent_yaml = f.read()
                    print(f"ℹ️ Config not found at standard path. Loaded fallback weather-agent.yaml instead.")
            except FileNotFoundError:
                print(f"❌ Agent YAML configuration not found at: {yaml_path}")
                return

    # Parse metadata dynamically
    agent_name, agent_desc = extract_metadata_from_yaml(agent_yaml)

    # 1. Register a new MCP Tool dynamically
    print(f"\n[Step 1] Registering MCP tool '{args.tool_name}'...")
    tool_payload = {
        "name": args.tool_name,
        "description": args.tool_desc,
        "protocol": "MCP",
        "endpoint": args.tool_endpoint
    }
    
    # Check if tool already exists, clean it up if it does
    list_tools, _ = make_request(f"{BACKEND_URL}/tools")
    for t in list_tools:
        if t["name"] == args.tool_name:
            print(f"ℹ️ Existing tool '{args.tool_name}' found. Cleaning it up first...")
            make_request(f"{BACKEND_URL}/tools/{t['id']}", "DELETE")
            time.sleep(0.5)

    tool_res, status = make_request(f"{BACKEND_URL}/tools", "POST", tool_payload)
    if status in (200, 201):
        tool_id = tool_res["id"]
        print(f"✅ Tool '{args.tool_name}' registered successfully (ID: {tool_id}).")
    else:
        print(f"❌ Failed to register tool: {tool_res}")
        return

    # 2. Register a new Agent
    print(f"\n[Step 2] Registering agent '{agent_name}'...")
    agent_payload = {
        "name": agent_name,
        "description": agent_desc,
        "owner": "dev-team"
    }
    
    # Check if agent already exists, clean it up if it does
    list_agents, _ = make_request(f"{BACKEND_URL}/agents")
    for a in list_agents:
        if a["name"] == agent_name:
            print(f"ℹ️ Existing agent '{agent_name}' found. Cleaning it up first...")
            make_request(f"{BACKEND_URL}/agents/{a['id']}", "DELETE")
            time.sleep(0.5)

    agent_res, status = make_request(f"{BACKEND_URL}/agents", "POST", agent_payload)
    if status in (200, 201):
        agent_id = agent_res["id"]
        print(f"✅ Agent '{agent_name}' registered successfully (ID: {agent_id}).")
    else:
        print(f"❌ Failed to register agent: {agent_res}")
        return

    # 3. Upload Agent YAML definition linking the registered tool
    print("\n[Step 3] Uploading YAML version definition...")
    # Clean the YAML indent string representation if we dynamically loaded it
    version_payload = {
        "definition": agent_yaml,
        "changelog": f"Initial deployment linking tool {args.tool_name}"
    }
    
    version_res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/versions", "POST", version_payload)
    if status in (200, 201):
        print("✅ YAML uploaded & active version generated.")
    else:
        print(f"❌ Failed to upload version definition: {version_res}")
        return

    # 4. Invoke Agent (executes the tool dynamically)
    print(f"\n[Step 4] Invoking '{agent_name}'...")
    invoke_payload = {
        "message": args.prompt,
        "context": "Assume metric units if not specified."
    }
    
    invoke_res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/invoke", "POST", invoke_payload)
    if status in (200, 201):
        print("\n🎉 Invocation Successful!")
        print("----------------------------------------------------------")
        print(f"Response:\n{invoke_res.get('result')}")
        print("----------------------------------------------------------")
        print("\n🔍 Execution Spans & Tracing Details:")
        trace = invoke_res.get("trace", {})
        print(f"  Trace ID: {trace.get('traceId')}")
        print(f"  Latency: {trace.get('latencyMs')}ms")
        print(f"  Cost: ${trace.get('estimatedCostUsd')} USD")
        print("  Spans:")
        for span in trace.get("spans", []):
            print(f"    - [{span.get('type')}] {span.get('name')} (Took {span.get('latencyMs')}ms)")
    else:
        print(f"❌ Invocation failed: {invoke_res}")

    # 5. Clean up Agent and Tool (Demonstrating Cascading Deletes)
    print("\n[Step 5] Cleaning up resources...")
    
    print(f"🧹 Deleting Agent '{agent_name}'...")
    _, del_agent_status = make_request(f"{BACKEND_URL}/agents/{agent_id}", "DELETE")
    if del_agent_status in (200, 204):
        print("✅ Agent and all its execution logs deleted successfully.")
    else:
        print(f"⚠️ Agent deletion returned status code: {del_agent_status}")

    print(f"🧹 Deleting Tool '{args.tool_name}'...")
    _, del_tool_status = make_request(f"{BACKEND_URL}/tools/{tool_id}", "DELETE")
    if del_tool_status in (200, 204):
        print("✅ MCP Tool deleted successfully.")
    else:
        print(f"⚠️ Tool deletion returned status code: {del_tool_status}")

    print("\n==========================================================")
    print("✨ Demo Completed Successfully!")
    print("==========================================================")

if __name__ == "__main__":
    main()
