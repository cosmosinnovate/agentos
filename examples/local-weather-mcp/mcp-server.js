const http = require('http');

const PORT = 8088;

// Canned weather database for simulation
const WEATHER_DATABASE = {
  seattle: { temp: '54°F', condition: 'Rainy', wind: '12 mph SW', humidity: '82%' },
  'san francisco': { temp: '62°F', condition: 'Windy/Foggy', wind: '18 mph W', humidity: '70%' },
  sf: { temp: '62°F', condition: 'Windy/Foggy', wind: '18 mph W', humidity: '70%' },
  'new york': { temp: '75°F', condition: 'Sunny', wind: '5 mph E', humidity: '45%' },
  ny: { temp: '75°F', condition: 'Sunny', wind: '5 mph E', humidity: '45%' },
  nyc: { temp: '75°F', condition: 'Sunny', wind: '5 mph E', humidity: '45%' },
  london: { temp: '58°F', condition: 'Cloudy', wind: '8 mph N', humidity: '65%' },
  tokyo: { temp: '70°F', condition: 'Clear', wind: '4 mph S', humidity: '50%' },
  paris: { temp: '68°F', condition: 'Partly Cloudy', wind: '6 mph W', humidity: '55%' },
};

const server = http.createServer((req, res) => {
  // CORS Headers to allow direct browser checks if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 1. GET /tools -> List tools
  if (req.method === 'GET' && url.pathname === '/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        tools: [
          {
            name: 'local-weather',
            description: 'Retrieve real-time local weather forecasts (temperature, conditions, wind, humidity) for a given city.',
            inputSchema: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city name or location query (e.g. Seattle, Tokyo, San Francisco)',
                },
              },
              required: ['location'],
            },
          },
        ],
      })
    );
    return;
  }

  // 2. POST /tools/call -> Execute the tool call
  if (req.method === 'POST' && url.pathname === '/tools/call') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const location = (payload.arguments?.location || payload.location || '').toLowerCase().trim();

        if (!location) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing "location" parameter in arguments.' }));
          return;
        }

        const data = WEATHER_DATABASE[location] || {
          temp: `${60 + Math.floor(Math.random() * 20)}°F`,
          condition: ['Sunny', 'Cloudy', 'Rainy', 'Overcast', 'Humid'][Math.floor(Math.random() * 5)],
          wind: `${2 + Math.floor(Math.random() * 15)} mph VAR`,
          humidity: `${40 + Math.floor(Math.random() * 50)}%`,
        };

        const resultText = `Current weather report for ${location.toUpperCase()}:
          - Temperature: ${data.temp}
          - Conditions: ${data.condition}
          - Wind: ${data.wind}
          - Humidity: ${data.humidity}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
            meta: {
              source: 'local-weather-mcp-server',
              timestamp: new Date().toISOString(),
            },
          })
        );
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request payload.', details: err.message }));
      }
    });
    return;
  }

  // 3. Fallback / Health Check
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'OK',
      mcpServer: 'local-weather-mcp',
      endpoints: {
        listTools: 'GET /tools',
        callTool: 'POST /tools/call',
      },
    })
  );
});

server.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(`📡 Local Weather MCP Server is running at http://localhost:${PORT}`);
  console.log(`- List tools endpoint: http://localhost:${PORT}/tools`);
  console.log(`- Call tool endpoint: http://localhost:${PORT}/tools/call`);
  console.log(`==========================================================`);
});
