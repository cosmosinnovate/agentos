#!/usr/bin/env python3
import os
import json
import urllib.request
import urllib.error
import argparse
import re
import time

def make_request(url, method="GET", data=None, timeout=90):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    
    body = None
    if data:
        body = json.dumps(data).encode("utf-8")
        
    try:
        with urllib.request.urlopen(req, data=body, timeout=timeout) as response:
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

def check_ollama(ollama_url):
    try:
        with urllib.request.urlopen(f"{ollama_url}/api/tags", timeout=2) as response:
            return response.status == 200
    except Exception:
        return False

def register_tool(backend_url, tool_str):
    """
    Parses 'name:endpoint' or 'name:endpoint:description' and registers it.
    """
    if ":" not in tool_str:
        name = tool_str.strip()
        endpoint = ""
        description = f"MCP Tool: {name}"
    else:
        name, rest = tool_str.split(":", 1)
        name = name.strip()
        rest = rest.strip()
        
        endpoint = rest
        description = f"MCP Tool: {name}"
        
        if rest.count(":") >= 1:
            right_parts = rest.rsplit(":", 1)
            # If the right part is not all digits (i.e. not just a port) and doesn't start with //, it's the description
            if not right_parts[1].isdigit() and not right_parts[1].startswith("//"):
                endpoint = right_parts[0].strip()
                description = right_parts[1].strip()
    
    # Add protocol prefix if missing
    if endpoint and not endpoint.startswith("http"):
        # Handle protocol-relative URL representation
        if endpoint.startswith("//"):
            endpoint = "http:" + endpoint
        else:
            endpoint = "http://" + endpoint

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
        # Build a fallback schema for known weather agent
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
    
    # Clean up existing tool with same name
    list_tools, _ = make_request(f"{backend_url}/tools")
    if isinstance(list_tools, list):
        for t in list_tools:
            if isinstance(t, dict) and t.get("name") == name:
                print(f"ℹ️ Existing tool '{name}' found. Cleaning it up first...")
                make_request(f"{backend_url}/tools/{t['id']}", "DELETE")
                time.sleep(0.5)
            
    res, status = make_request(f"{backend_url}/tools", "POST", tool_payload)
    if status in (200, 201):
        print(f"✅ Registered tool '{name}' successfully (ID: {res['id']}).")
        return res["id"]
    else:
        print(f"❌ Failed to register tool '{name}': {res}")
        return None

def register_agent(backend_url, yaml_path, ollama_ok):
    if not os.path.exists(yaml_path):
        print(f"❌ YAML definition file not found at: {yaml_path}")
        return None, None
        
    try:
        with open(yaml_path, "r") as f:
            agent_yaml = f.read()
    except Exception as e:
        print(f"❌ Error reading YAML file {yaml_path}: {e}")
        return None, None

    # Parse metadata dynamically
    agent_name, agent_desc = extract_metadata_from_yaml(agent_yaml)
    
    if not ollama_ok:
        print(f"⚠️ Ollama NOT running. Modifying '{agent_name}' config to use 'mock' provider.")
        agent_yaml = agent_yaml.replace("provider: ollama", "provider: mock")
        
    agent_payload = {
        "name": agent_name,
        "description": agent_desc,
        "owner": "demo-orchestrator"
    }
    
    # Check if agent already exists, clean up if it does
    list_agents, _ = make_request(f"{backend_url}/agents")
    if isinstance(list_agents, list):
        for a in list_agents:
            if isinstance(a, dict) and a.get("name") == agent_name:
                print(f"ℹ️ Existing agent '{agent_name}' found. Cleaning it up first...")
                make_request(f"{backend_url}/agents/{a['id']}", "DELETE")
                time.sleep(0.5)
            
    res, status = make_request(f"{backend_url}/agents", "POST", agent_payload)
    if status not in (200, 201):
        print(f"❌ Failed to register agent '{agent_name}': {res}")
        return None, None
        
    agent_id = res["id"]
    print(f"✅ Registered agent '{agent_name}' successfully (ID: {agent_id}).")
    
    # Upload YAML definition
    version_payload = {
        "definition": agent_yaml,
        "changelog": "Loaded via generic run_demo.py"
    }
    v_res, v_status = make_request(f"{backend_url}/agents/{agent_id}/versions", "POST", version_payload)
    if v_status in (200, 201):
        print(f"✅ Uploaded YAML definition for '{agent_name}'.")
        return agent_name, agent_id
    else:
        print(f"❌ Failed to upload YAML definition for '{agent_name}': {v_res}")
        return None, None

def main():
    parser = argparse.ArgumentParser(description="AgentOS Generic Example Demo Runner")
    parser.add_argument(
        "--backend-url",
        type=str,
        default="http://localhost:3001/api/v1",
        help="URL of the AgentOS Backend API"
    )
    parser.add_argument(
        "--ollama-url",
        type=str,
        default="http://localhost:11434",
        help="URL of the Ollama LLM server"
    )
    parser.add_argument(
        "--tools",
        type=str,
        nargs="*",
        default=[],
        help="List of tools to register in format 'name:endpoint[:description]' (e.g. local-weather:http://host.docker.internal:8088)"
    )
    parser.add_argument(
        "--agents",
        type=str,
        nargs="+",
        required=True,
        help="Path(s) to agent YAML configuration file(s) (e.g. ollama-single-agent/weather-agent.yaml)"
    )
    parser.add_argument(
        "--invoke",
        type=str,
        help="Name of the agent to invoke. Defaults to the last registered agent."
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default="Hello!",
        help="Prompt message to send to the target agent"
    )
    parser.add_argument(
        "--context",
        type=str,
        help="Optional invocation context. Supports '{agent_name}' variable replacement (e.g. 'Sub-agent custom-writer ID is {custom-writer}.')"
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Delete registered tools and agents after execution"
    )
    
    args = parser.parse_args()

    print("==========================================================")
    print("🚀 AgentOS Reusable example runner")
    print("==========================================================")
    
    ollama_ok = check_ollama(args.ollama_url)
    if ollama_ok:
        print("✅ Ollama detected running locally.")
    else:
        print("ℹ️ Ollama is NOT detected running locally. Provider configs will fall back to 'mock' where needed.")

    # 1. Register tools
    registered_tools = []
    for tool_str in args.tools:
        tool_id = register_tool(args.backend_url, tool_str)
        if tool_id:
            registered_tools.append(tool_id)

    # 2. Register agents
    registered_agents = {}
    last_agent_name = None
    
    for agent_path in args.agents:
        name, aid = register_agent(args.backend_url, agent_path, ollama_ok)
        if name and aid:
            registered_agents[name] = aid
            last_agent_name = name

    if not registered_agents:
        print("❌ No agents were successfully registered. Exiting.")
        return

    # Determine target agent to invoke
    target_agent_name = args.invoke if args.invoke else last_agent_name
    if target_agent_name not in registered_agents:
        print(f"❌ Target agent to invoke '{target_agent_name}' was not registered. Available agents: {list(registered_agents.keys())}")
        return
        
    target_agent_id = registered_agents[target_agent_name]

    # 3. Dynamic placeholder replacement in prompt and context
    prompt = args.prompt
    context = args.context if args.context else ""
    
    for name, aid in registered_agents.items():
        placeholder = f"{{{name}}}"
        prompt = prompt.replace(placeholder, aid)
        context = context.replace(placeholder, aid)

    # 4. Invoke agent
    print(f"\n--- Invoking Agent '{target_agent_name}' ---")
    print(f"Query: \"{prompt}\"")
    if context:
        print(f"Context: \"{context}\"")
        
    invoke_payload = {
        "message": prompt
    }
    if context:
        invoke_payload["context"] = context
        
    res, status = make_request(f"{args.backend_url}/agents/{target_agent_id}/invoke", "POST", invoke_payload, timeout=90)
    
    if status in (200, 201):
        print("\n🎉 Invocation Successful!")
        print("----------------------------------------------------------")
        print(f"Response:\n{res.get('result')}")
        print("----------------------------------------------------------")
        
        # Display trace logs
        trace = res.get("trace", {})
        if trace:
            print("\n🔍 Trace & Telemetry Details:")
            print(f"  Trace ID: {trace.get('traceId')}")
            print(f"  Latency: {trace.get('latencyMs')}ms")
            print(f"  Cost: ${trace.get('estimatedCostUsd')} USD")
            print("  Telemetry Spans:")
            for span in trace.get("spans", []):
                print(f"    - [{span.get('type')}] {span.get('name')} (Took {span.get('latencyMs')}ms)")
    else:
        print(f"\n❌ Invocation failed: {res}")

    # 5. Clean up if requested
    if args.cleanup:
        print("\n🧹 Cleaning up registered resources...")
        
        # Delete agents
        for name, aid in registered_agents.items():
            print(f"  Deleting Agent '{name}'...")
            make_request(f"{args.backend_url}/agents/{aid}", "DELETE")
            
        # Delete tools
        for tid in registered_tools:
            print(f"  Deleting Tool ID '{tid}'...")
            make_request(f"{args.backend_url}/tools/{tid}", "DELETE")

    print("\n==========================================================")
    print("✨ Execution finished!")
    print("==========================================================")

if __name__ == "__main__":
    main()
