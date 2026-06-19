import http.server
import json
import sys

PORT = 8089

class ExternalAgentHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            payload = json.loads(post_data.decode('utf-8'))
        except Exception as e:
            self.send_error_response(400, f"Invalid JSON payload: {str(e)}")
            return
            
        print(f"📥 Received invocation payload: {payload}", flush=True)
        
        # Extract arguments
        topic = payload.get('topic', 'General Inquiry')
        points = payload.get('points', [])
        
        if isinstance(points, str):
            points = [points]
            
        points_str = "\n".join([f"  * {p}" for p in points]) if points else "  * No points provided."
        
        # Simulate processing work
        summary_text = (
            f"=== [External Python Summarizer Agent Output] ===\n"
            f"Topic: {topic}\n"
            f"Extracted Points:\n{points_str}\n"
            f"Summary: The data indicates that {topic} is highly relevant and requires prompt attention. "
            f"This summary was compiled dynamically by the external Python agent running on port {PORT}."
        )
        
        response_payload = {
            "status": "success",
            "result": summary_text
        }
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response_payload).encode('utf-8'))
        print(f"📤 Sent response to Control Plane.", flush=True)

    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "name": "external-summarizer",
                "description": "Summarizes topics and extracted points",
                "version": "1.0.0",
                "status": "active",
                "tools": [
                    {
                        "name": "web-search",
                        "description": "Searches the web for information",
                        "protocol": "REST",
                        "endpoint": "https://api.example.com/web-search",
                        "isActive": True
                    }
                ]
            }).encode('utf-8'))
            print(f"📤 Sent health check response to Control Plane.", flush=True)
        else:
            self.send_error_response(404, 'Not Found')

    def send_error_response(self, status_code, message):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode('utf-8'))

def main():
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, ExternalAgentHandler)
    print(f"🚀 External Python Agent Server listening on port {PORT}...", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...", flush=True)
        sys.exit(0)

if __name__ == '__main__':
    main()
