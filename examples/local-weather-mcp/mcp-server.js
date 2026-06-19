const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8088;

// Native helper to load environment variables from potential local .env files
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), 'examples', '.env copy'),
    path.join(process.cwd(), 'examples', '.env'),
    path.join(process.cwd(), 'examples', '.env.local'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '.env.local'),
  ];

  const envVars = {};

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        let loadedAny = false;
        for (const line of lines) {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            // Strip quotes
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
              value = value.substring(1, value.length - 1);
            } else if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
              value = value.substring(1, value.length - 1);
            }
            value = value.trim();
            if (value !== '') {
              envVars[key] = value;
              loadedAny = true;
            }
          }
        }
        if (loadedAny) {
          console.log(`ℹ️ Loaded environment variables from: ${envPath}`);
        }
      } catch (err) {
        console.warn(`Failed to parse env file at ${envPath}:`, err.message);
      }
    }
  }

  for (const [key, value] of Object.entries(envVars)) {
    if (!process.env[key] || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

loadEnv();

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

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const location = (payload.arguments?.location || payload.location || '').toLowerCase().trim();

        if (!location) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing "location" parameter in arguments.' }));
          return;
        }

        const apiKey = process.env.OPENWEATHER_API_KEY;
        console.log(`[Weather Server] Calling weather tool for "${location}". Checking API key...`);

        if (!apiKey) {
          console.warn(`[Weather Server] API key not found (OPENWEATHER_API_KEY is missing or empty). Using simulated database.`);
          return;
        }

        // Live OpenWeatherMap API implementation
        try {
          // 1. Resolve coordinates via Geocoding API
          const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
          const geoRes = await fetch(geoUrl);
          if (!geoRes.ok) {
            throw new Error(`Geocoding request failed with status ${geoRes.status}`);
          }
          const geoData = await geoRes.json();
          if (!geoData || geoData.length === 0) {
            throw new Error(`Location '${location}' not found.`);
          }

          const { lat, lon, name: resolvedName, country, state } = geoData[0];
          const locationString = `${resolvedName}${state ? `, ${state}` : ''}, ${country}`;

          let weatherData = null;
          let source = 'open-weather-one-call';

          // 2. Attempt One Call 3.0 API
          try {
            const oneCallUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&appid=${apiKey}&units=imperial`;
            const oneCallRes = await fetch(oneCallUrl);
            if (oneCallRes.ok) {
              weatherData = await oneCallRes.json();
            } else {
              console.warn(`[Weather Server] One Call 3.0 failed (status ${oneCallRes.status}). Falling back to Current Weather API (2.5).`);
            }
          } catch (oneCallErr) {
            console.warn(`[Weather Server] One Call 3.0 request error: ${oneCallErr.message}. Falling back to Current Weather API (2.5).`);
          }

          // 3. Fallback to Current Weather API (v2.5)
          if (!weatherData) {
            source = 'open-weather-current';
            const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
            const currentWeatherRes = await fetch(currentWeatherUrl);
            if (!currentWeatherRes.ok) {
              throw new Error(`Current weather request failed with status ${currentWeatherRes.status}`);
            }
            weatherData = await currentWeatherRes.json();
          }

          // 4. Extract telemetry parameters
          let temp, condition, wind, humidity;
          if (source === 'open-weather-one-call') {
            const current = weatherData.current || {};
            temp = `${Math.round(current.temp)}°F`;
            condition = current.weather?.[0]?.main || 'Unknown';
            wind = `${Math.round(current.wind_speed)} mph at ${current.wind_deg}°`;
            humidity = `${current.humidity}%`;
          } else {
            const main = weatherData.main || {};
            const windObj = weatherData.wind || {};
            temp = `${Math.round(main.temp)}°F`;
            condition = weatherData.weather?.[0]?.main || 'Unknown';
            wind = `${Math.round(windObj.speed)} mph at ${windObj.deg}°`;
            humidity = `${main.humidity}%`;
          }

          console.log(`[Weather Server] Weather data for ${locationString.toUpperCase()}:`, weatherData);
          console.log(`[Weather Server] Location String: ${locationString}`);

          const resultText = `Current weather report for ${locationString.toUpperCase()}:
            - Temperature: ${temp}
            - Conditions: ${condition}
            - Wind: ${wind}
            - Humidity: ${humidity}`;

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
                source,
                timestamp: new Date().toISOString(),
              },
            })
          );
        } catch (apiErr) {
          console.error(`[Weather Server] API query failure: ${apiErr.message}. Falling back to simulated database.`);

          const data = WEATHER_DATABASE[location] || {
            temp: `${60 + Math.floor(Math.random() * 20)}°F`,
            condition: ['Sunny', 'Cloudy', 'Rainy', 'Overcast', 'Humid'][Math.floor(Math.random() * 5)],
            wind: `${2 + Math.floor(Math.random() * 15)} mph VAR`,
            humidity: `${40 + Math.floor(Math.random() * 50)}%`,
          };

          const resultText = `Current weather report for ${location.toUpperCase()} [SIMULATED - API FALLBACK]:
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
                source: 'local-weather-mcp-server-simulated-fallback',
                timestamp: new Date().toISOString(),
                error: apiErr.message,
              },
            })
          );
        }
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
  if (process.env.OPENWEATHER_API_KEY) {
    const key = process.env.OPENWEATHER_API_KEY;
    const masked = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : '***';
    console.log(`- API Key: Present (${masked})`);
  } else {
    console.warn(`- API Key: Missing (running in simulated database mode)`);
  }
  console.log(`==========================================================`);
});
