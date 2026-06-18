const http = require('http');

const PORT = 8089;

// Canned flight schedules database for simulation
const FLIGHT_DATABASE = {
  'sea-lax': [
    { flightNo: 'AS-1204', airline: 'Alaska Airlines', depTime: '08:15 AM', arrTime: '11:00 AM', price: '$189', duration: '2h 45m' },
    { flightNo: 'DL-2415', airline: 'Delta Air Lines', depTime: '01:30 PM', arrTime: '04:20 PM', price: '$210', duration: '2h 50m' },
    { flightNo: 'UA-403', airline: 'United Airlines', depTime: '06:45 PM', arrTime: '09:35 PM', price: '$165', duration: '2h 50m' }
  ],
  'lax-sea': [
    { flightNo: 'AS-1405', airline: 'Alaska Airlines', depTime: '09:00 AM', arrTime: '11:50 AM', price: '$195', duration: '2h 50m' },
    { flightNo: 'DL-2212', airline: 'Delta Air Lines', depTime: '03:15 PM', arrTime: '06:05 PM', price: '$225', duration: '2h 50m' }
  ],
  'nyc-lhr': [
    { flightNo: 'BA-178', airline: 'British Airways', depTime: '10:00 AM', arrTime: '10:10 PM', price: '$580', duration: '7h 10m' },
    { flightNo: 'VS-4', airline: 'Virgin Atlantic', depTime: '06:30 PM', arrTime: '06:45 AM (+1)', price: '$620', duration: '7h 15m' },
    { flightNo: 'AA-100', airline: 'American Airlines', depTime: '07:15 PM', arrTime: '07:30 AM (+1)', price: '$540', duration: '7h 15m' }
  ],
  'lax-nrt': [
    { flightNo: 'JL-61', airline: 'Japan Airlines', depTime: '01:05 PM', arrTime: '04:45 PM (+1)', price: '$980', duration: '11h 40m' },
    { flightNo: 'NH-175', airline: 'All Nippon Airways', depTime: '11:30 AM', arrTime: '03:00 PM (+1)', price: '$1020', duration: '11h 30m' }
  ]
};

const server = http.createServer((req, res) => {
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
            name: 'local-flights',
            description: 'Search for local flight schedules, durations, airlines, and prices between an origin and destination city.',
            inputSchema: {
              type: 'object',
              properties: {
                origin: {
                  type: 'string',
                  description: 'The departure airport code or city name (e.g. SEA, NYC, LAX)',
                },
                destination: {
                  type: 'string',
                  description: 'The arrival airport code or city name (e.g. LAX, LHR, NRT)',
                },
              },
              required: ['origin', 'destination'],
            },
          },
        ],
      })
    );
    return;
  }

  // 2. POST /tools/call -> Execute the flight search
  if (req.method === 'POST' && url.pathname === '/tools/call') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const args = payload.arguments || payload;
        const origin = (args.origin || '').toLowerCase().trim();
        const destination = (args.destination || '').toLowerCase().trim();

        if (!origin || !destination) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing "origin" or "destination" parameter in arguments.' }));
          return;
        }

        const routeKey = `${origin}-${destination}`;
        const flights = FLIGHT_DATABASE[routeKey] || [
          {
            flightNo: `XX-${100 + Math.floor(Math.random() * 899)}`,
            airline: 'Dynamic Air',
            depTime: '10:00 AM',
            arrTime: '01:30 PM',
            price: `$${150 + Math.floor(Math.random() * 300)}`,
            duration: '3h 30m'
          },
          {
            flightNo: `YY-${100 + Math.floor(Math.random() * 899)}`,
            airline: 'Global Express',
            depTime: '04:15 PM',
            arrTime: '07:45 PM',
            price: `$${200 + Math.floor(Math.random() * 400)}`,
            duration: '3h 30m'
          }
        ];

        let resultText = `Available flights from ${origin.toUpperCase()} to ${destination.toUpperCase()}:`;
        flights.forEach((f) => {
          resultText += `\n- ${f.flightNo} (${f.airline}): Departs ${f.depTime} | Arrives ${f.arrTime} | Price: ${f.price} | Duration: ${f.duration}`;
        });

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
              source: 'local-flights-mcp-server',
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

  // Fallback
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'OK',
      mcpServer: 'local-flights-mcp',
      endpoints: {
        listTools: 'GET /tools',
        callTool: 'POST /tools/call',
      },
    })
  );
});

server.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(`📡 Local Flights MCP Server is running at http://localhost:${PORT}`);
  console.log(`- List tools endpoint: http://localhost:${PORT}/tools`);
  console.log(`- Call tool endpoint: http://localhost:${PORT}/tools/call`);
  console.log(`==========================================================`);
});
