const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { NodeVM } = require('vm2');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Configuration for both providers
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_HEADERS = {
  "anthropic-version": "2023-06-01",
  "content-type": "application/json"
};

// Local Ollama configuration (no external backend required)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b';

// Remove the old fetch import and add a fallback for older Node.js
const fetch = (typeof global.fetch === 'function') ? global.fetch : (...args) => import('node-fetch').then(mod => mod.default(...args));

async function generateCodeWithClaude(input, prompt, lang, apiKey) {
  if (!apiKey) {
    throw new Error("Anthropic API key is required");
  }

  const system = `You are a code generator. `
               + `Output ONLY valid, executable ${lang.toUpperCase()} code wrapped in triple backticks. `
               + `The code must define a function transform(text) that returns a string. ALWAYS return valid code.`;
  
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: system,
    messages: [
      { role: "user", content:
        `Input text:\n<<<\n${input}\n>>>\n\nUser prompt: ${prompt}` }
    ]
  };
  
  const headers = {
    ...CLAUDE_HEADERS,
    "x-api-key": apiKey
  };
  
  console.log('Calling Claude API...');
  const response = await fetch(CLAUDE_URL, { method: "POST", headers, body: JSON.stringify(body) });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || `Claude API error: ${response.status}`);
  }

  if (!result.content || !Array.isArray(result.content) || !result.content[0] || !result.content[0].text) {
    console.error("Claude API unexpected response:", result);
    throw new Error("Claude API returned unexpected response format");
  }

  const raw = result.content[0].text;
  const code = raw.match(/```[a-z]*\s*([\s\S]*?)```/)?.[1] ?? raw;
  return code.trim();
}

function createSystemPrompt(lang) {
  return `You are a code generator. \n+ Output ONLY valid ${lang.toUpperCase()} wrapped in triple backticks. \n+ The code must define a function transform(text) that returns a string.\n+ Do not include any explanations or comments outside the code block.\n+ Ensure the function is complete and ready to execute.`;
}

function createUserPrompt(input, prompt) {
  return `Input text:\n<<<\n${input}\n>>>\n\nUser prompt: ${prompt}`;
}

async function generateCodeWithOllama(input, prompt, lang, apiKey = null) {
  if (!input || !prompt || !lang) {
    throw new Error("Missing input, prompt, or language");
  }

  const systemPrompt = createSystemPrompt(lang);
  const userPrompt = createUserPrompt(input, prompt);

  const payload = {
    model: OLLAMA_MODEL,
    prompt: `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`,
    stream: false,
    options: {
      temperature: 0.1,
      top_p: 0.9,
      num_predict: 1024,
      stop: ["User:", "Human:", "\n\nUser:", "\n\nHuman:"]
    }
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  // Optional future auth header; currently unused for local Ollama
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  console.log('Calling Ollama directly:', `${OLLAMA_URL}/api/generate`, 'model:', OLLAMA_MODEL);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const raw = data.response || '';
    const code = raw.match(/```[a-z]*\s*([\s\S]*?)```/)?.[1] ?? raw;
    return code.trim();

  } catch (error) {
    console.error('Ollama call failed:', error.message);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      throw new Error('Ollama is not reachable. Ensure `ollama serve` is running.');
    }
    throw error;
  }
}

async function generateCode(input, prompt, lang, config) {
  if (!input || !prompt || !lang) {
    throw new Error("Missing input, prompt, or language");
  }

  const { provider, apiKey } = config || {};

  if (provider === 'claude') {
    return await generateCodeWithClaude(input, prompt, lang, apiKey);
  } else {
    return await generateCodeWithOllama(input, prompt, lang, apiKey);
  }
}

// Health check function for local Ollama
async function checkBackendHealth() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models.map(m => m.name) : [];
    const health = {
      status: 'healthy',
      provider: 'OLLAMA',
      model: OLLAMA_MODEL,
      models,
      timestamp: new Date().toISOString()
    };
    console.log('Ollama health check:', health);
    return health;
  } catch (error) {
    console.error('Ollama health check failed:', error.message);
    return { status: 'unhealthy', provider: 'OLLAMA', model: OLLAMA_MODEL, error: error.message };
  }
}

// Get available models from local Ollama
async function getAvailableModels() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data?.models) ? data.models.map(m => m.name) : [];
  } catch (error) {
    console.error('Failed to fetch models from Ollama:', error.message);
    return [];
  }
}

// Test Claude API connection
async function testClaudeConnection(apiKey) {
  try {
    const response = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        ...CLAUDE_HEADERS,
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Claude connection test failed:', error);
    return false;
  }
}

// IPC handlers
ipcMain.handle('generate-code', async (event, input, prompt, lang, config) => {
  return await generateCode(input, prompt, lang, config);
});

ipcMain.handle('check-backend-health', async () => {
  return await checkBackendHealth();
});

ipcMain.handle('get-available-models', async () => {
  return await getAvailableModels();
});

ipcMain.handle('test-claude-connection', async (event, apiKey) => {
  return await testClaudeConnection(apiKey);
});

function runJS(code, input) {
  const vm = new NodeVM({
    console: "inherit",
    sandbox: {},
    timeout: 2000, // 2 s hard cap
    eval: false, 
    wasm: false
  });

  const wrapped = `
${code}
module.exports = transform;
  `;

  const fn = vm.run(wrapped, "generated.js");
  return fn(input);
}

ipcMain.handle('run-js', async (event, code, input) => {
  return runJS(code, input);
});

// Perform health check on startup
app.whenReady().then(async () => {
  setTimeout(async () => {
    const health = await checkBackendHealth();
    if (health.status !== 'healthy') {
      console.warn('⚠️  Ollama is not healthy or not reachable.');
      console.log('📋 Ensure Ollama is running: `ollama serve`');
      console.log(`📋 Optionally pull the model: ollama pull ${OLLAMA_MODEL}`);
    } else {
      console.log('✅ Ollama is healthy and ready!');
    }
  }, 1000);
});