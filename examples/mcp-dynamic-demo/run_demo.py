import os
import json
import urllib.request
import urllib.error
import time

BACKEND_URL = "http://localhost:3001/api/v1"

def make_request(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    
    body = None
    if data:
        body = json.dumps(data).encode("utf-8")
            
    try:
        with urllib.request.urlopen(req, data=body, timeout=10) as response:
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

def main():
    print("==========================================================")
    print("🚀 AgentOS Dynamic Tool & Agent Lifecycle Demo")
    print("==========================================================")

    # 1. Register a new MCP Tool dynamically
    print("\n[Step 1] Registering MCP weather tool...")
    tool_payload = {
        "name": "local-weather",
        "description": "Retrieve real-time weather forecasts (temperature, conditions) for a given city.",
        "protocol": "MCP",
        "endpoint": "http://localhost:8088"
    }
    
    # Check if tool already exists, clean it up if it does
    list_tools, _ = make_request(f"{BACKEND_URL}/tools")
    for t in list_tools:
        if t["name"] == "local-weather":
            print("ℹ️ Existing weather tool found. Cleaning it up first...")
            make_request(f"{BACKEND_URL}/tools/{t['id']}", "DELETE")
            time.sleep(0.5)

    tool_res, status = make_request(f"{BACKEND_URL}/tools", "POST", tool_payload)
    if status in (200, 201):
        tool_id = tool_res["id"]
        print(f"✅ Tool 'local-weather' registered successfully (ID: {tool_id}).")
    else:
        print(f"❌ Failed to register tool: {tool_res}")
        return

    # 2. Register a new Agent
    print("\n[Step 2] Registering agent 'weather-assistant'...")
    agent_payload = {
        "name": "weather-assistant",
        "description": "Assistant specialized in checking weather via MCP",
        "owner": "dev-team"
    }
    
    # Check if agent already exists, clean it up if it does
    list_agents, _ = make_request(f"{BACKEND_URL}/agents")
    for a in list_agents:
        if a["name"] == "weather-assistant":
            print("ℹ️ Existing weather-assistant found. Cleaning it up first...")
            make_request(f"{BACKEND_URL}/agents/{a['id']}", "DELETE")
            time.sleep(0.5)

    agent_res, status = make_request(f"{BACKEND_URL}/agents", "POST", agent_payload)
    if status in (200, 201):
        agent_id = agent_res["id"]
        print(f"✅ Agent 'weather-assistant' registered successfully (ID: {agent_id}).")
    else:
        print(f"❌ Failed to register agent: {agent_res}")
        return

    # 3. Upload Agent YAML definition linking the registered tool
    print("\n[Step 3] Uploading YAML version definition...")
    agent_yaml = """apiVersion: agentos/v1
            kind: Agent
            metadata:
            name: weather-assistant
            spec:
            model:
                provider: mock
                name: mock-model
            tools:
                - local-weather
            deployment:
                provider: local
                region: us-east-1
            """
    version_payload = {
        "definition": agent_yaml,
        "changelog": "Initial deployment linking local-weather MCP tool"
    }
    
    version_res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/versions", "POST", version_payload)
    if status in (200, 201):
        print("✅ YAML uploaded & active version generated.")
    else:
        print(f"❌ Failed to upload version definition: {version_res}")
        return

    # 4. Invoke Agent (executes the weather tool dynamically)
    print("\n[Step 4] Invoking 'weather-assistant' (running dynamic tool call)...")
    invoke_payload = {
        "message": "What is the weather in Seattle?",
        "context": "Assume metric units if not specified."
    }
    
    invoke_res, status = make_request(f"{BACKEND_URL}/agents/{agent_id}/invoke", "POST", invoke_payload)
    if status == 200:
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
    
    print("🧹 Deleting Agent 'weather-assistant'...")
    _, del_agent_status = make_request(f"{BACKEND_URL}/agents/{agent_id}", "DELETE")
    if del_agent_status == 244 or del_agent_status == 204:
        print("✅ Agent and all its execution logs deleted successfully.")
    else:
        print(f"⚠️ Agent deletion returned status code: {del_agent_status}")

    print("🧹 Deleting Tool 'local-weather'...")
    _, del_tool_status = make_request(f"{BACKEND_URL}/tools/{tool_id}", "DELETE")
    if del_tool_status == 244 or del_tool_status == 204:
        print("✅ MCP Tool deleted successfully.")
    else:
        print(f"⚠️ Tool deletion returned status code: {del_tool_status}")

    print("\n==========================================================")
    print("✨ Demo Completed Successfully!")
    print("==========================================================")

if __name__ == "__main__":
    main()
