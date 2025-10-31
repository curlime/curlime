const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
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

// -------------------------
// Executed version persistence
// -------------------------

function getStoragePaths() {
  const baseDir = path.join(os.homedir(), '.curlime');
  const versionsFile = path.join(baseDir, 'versions.jsonl');
  const transformsIndex = path.join(baseDir, 'transforms.json');
  return { baseDir, versionsFile, transformsIndex };
}

function ensureStorage() {
  const { baseDir, versionsFile, transformsIndex } = getStoragePaths();
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(versionsFile)) {
    fs.writeFileSync(versionsFile, '', 'utf8');
  }
  if (!fs.existsSync(transformsIndex)) {
    fs.writeFileSync(transformsIndex, JSON.stringify({ version: 1, transforms: {} }, null, 2), 'utf8');
  }
}

function readTransformsIndex() {
  const { transformsIndex } = getStoragePaths();
  try {
    const raw = fs.readFileSync(transformsIndex, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object') return { version: 1, transforms: {} };
    if (!parsed.transforms || typeof parsed.transforms !== 'object') parsed.transforms = {};
    if (!parsed.version) parsed.version = 1;
    return parsed;
  } catch (_) {
    return { version: 1, transforms: {} };
  }
}

function writeTransformsIndexSafe(next) {
  const { transformsIndex } = getStoragePaths();
  const tmp = `${transformsIndex}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, transformsIndex);
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

ipcMain.handle('save-executed-version', async (event, payload) => {
  try {
    ensureStorage();
    const { versionsFile } = getStoragePaths();

    const versionRecord = {
      id: randomId(),
      ts: new Date().toISOString(),
      label: 'Execute',
      fields: {
        code: String(payload.code || ''),
        language: payload.language || 'js',
        provider: payload.provider || 'ollama',
        model: payload.model || null
      },
      execSnapshot: {
        input: String(payload.input || ''),
        prompt: String(payload.prompt || ''),
        result: String(payload.result || ''),
        durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : null,
        success: true
      }
    };

    fs.appendFileSync(versionsFile, JSON.stringify(versionRecord) + '\n', 'utf8');

    // Maintain a minimal index with a single implicit transform for now
    const index = readTransformsIndex();
    const transformId = 'default';
    const current = index.transforms[transformId] || {
      id: transformId,
      name: 'Default Transform',
      createdAt: new Date().toISOString(),
      updatedAt: null,
      currentVersionId: null,
      stats: { executes: 0 }
    };
    current.updatedAt = versionRecord.ts;
    current.currentVersionId = versionRecord.id;
    current.stats.executes = (current.stats.executes || 0) + 1;
    index.transforms[transformId] = current;
    writeTransformsIndexSafe(index);

    return { ok: true, versionId: versionRecord.id };
  } catch (error) {
    console.error('Failed to save executed version:', error.message);
    return { ok: false, error: error.message };
  }
});

// List recent executed versions (tail from JSONL)
ipcMain.handle('list-executed-versions', async (event, limit = 50) => {
  try {
    ensureStorage();
    const { versionsFile } = getStoragePaths();
    const raw = fs.readFileSync(versionsFile, 'utf8');
    if (!raw) return [];
    const lines = raw.trim().split('\n');
    const slice = lines.slice(-Math.max(1, Math.min(500, limit)));
    const items = [];
    for (const line of slice) {
      try {
        const obj = JSON.parse(line);
        items.push(obj);
      } catch (_) {
        // skip bad line
      }
    }
    // newest last in file; reverse to newest first
    return items.reverse();
  } catch (error) {
    console.error('Failed to list executed versions:', error.message);
    return [];
  }
});

// Minimal transforms list (single default transform for now)
ipcMain.handle('list-transforms', async () => {
  try {
    ensureStorage();
    const index = readTransformsIndex();
    return Object.values(index.transforms || {});
  } catch (error) {
    console.error('Failed to list transforms:', error.message);
    return [];
  }
});

function validateTransformCode(code) {
  if (typeof code !== 'string' || !code.trim()) return false;
  // Basic validation: must define a function transform
  return /function\s+transform\s*\(\s*text\s*\)/.test(code) || /const\s+transform\s*=\s*\(\s*text\s*\)\s*=>/.test(code);
}

ipcMain.handle('create-transform', async (event, payload) => {
  try {
    ensureStorage();
    const index = readTransformsIndex();
    const id = randomId();
    const now = new Date().toISOString();
    const code = String(payload.code || '');
    if (!validateTransformCode(code)) {
      return { ok: false, error: 'Invalid code: must define function transform(text)' };
    }
    const transform = {
      id,
      name: String(payload.name || 'Untitled Transform'),
      language: payload.language || 'js',
      provider: payload.provider || 'ollama',
      model: payload.model || null,
      samplePrompt: payload.samplePrompt || '',
      code,
      createdAt: now,
      updatedAt: now,
      stats: { uses: 0 }
    };
    index.transforms[id] = transform;
    writeTransformsIndexSafe(index);
    return { ok: true, id, transform };
  } catch (error) {
    console.error('create-transform failed:', error.message);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('get-transform', async (event, id) => {
  try {
    ensureStorage();
    const index = readTransformsIndex();
    return index.transforms[id] || null;
  } catch (error) {
    console.error('get-transform failed:', error.message);
    return null;
  }
});

ipcMain.handle('update-transform', async (event, id, fields) => {
  try {
    ensureStorage();
    const index = readTransformsIndex();
    const existing = index.transforms[id];
    if (!existing) return { ok: false, error: 'Not found' };
    const next = { ...existing, ...fields, updatedAt: new Date().toISOString() };
    if (fields && Object.prototype.hasOwnProperty.call(fields, 'code')) {
      if (!validateTransformCode(String(fields.code || ''))) {
        return { ok: false, error: 'Invalid code: must define function transform(text)' };
      }
    }
    index.transforms[id] = next;
    writeTransformsIndexSafe(index);
    return { ok: true };
  } catch (error) {
    console.error('update-transform failed:', error.message);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('delete-transform', async (event, id) => {
  try {
    ensureStorage();
    const index = readTransformsIndex();
    if (!index.transforms[id]) return { ok: false, error: 'Not found' };
    delete index.transforms[id];
    writeTransformsIndexSafe(index);
    return { ok: true };
  } catch (error) {
    console.error('delete-transform failed:', error.message);
    return { ok: false, error: error.message };
  }
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