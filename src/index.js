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

const CLAUDE_URL  = "https://api.anthropic.com/v1/messages";
const MODEL       = "claude-opus-4-20250514";
const HEADERS     = {
  "x-api-key":        process.env.ANTHROPIC_API_KEY,
  "anthropic-version":"2023-06-01",
  "content-type":     "application/json"
};

// Remove the old fetch import and add a fallback for older Node.js
const fetch = (typeof global.fetch === 'function') ? global.fetch : (...args) => import('node-fetch').then(mod => mod.default(...args));

async function generateCode(input, prompt, lang, apiKey) {
  if (!input || !prompt || !lang) {
    throw new Error("Missing input, prompt, or language");
  }
  const system = `You are a code generator. `
               + `Output ONLY valid ${lang.toUpperCase()} wrapped in triple backticks. `
               + `The code must define a function transform(text) that returns a string.`;
  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: system,
    messages: [
      { role: "user",   content:
        `Input text:\n<<<\n${input}\n>>>\n\nUser prompt: ${prompt}` }
    ]
  };
  const headers = {
    ...HEADERS,
    "x-api-key": apiKey || process.env.ANTHROPIC_API_KEY
  };
  console.log('Claude API headers:', headers); // DEBUG LOG
  const r = await fetch(CLAUDE_URL, { method:"POST", headers, body:JSON.stringify(body) });
  const j = await r.json();

  // Add error handling
  if (!j.content || !Array.isArray(j.content) || !j.content[0] || !j.content[0].text) {
    console.error("Claude API error or unexpected response:", j);
    throw new Error(j.error?.message || "Claude API error or unexpected response");
  }

  const raw  = j.content[0].text;
  const code = raw.match(/```[a-z]*\s*([\s\S]*?)```/)?.[1] ?? raw;
  return code.trim();
}

ipcMain.handle('generate-code', async (event, input, prompt, lang, apiKey) => {
  return await generateCode(input, prompt, lang, apiKey);
});

function runJS(code, input) {
  const vm = new NodeVM({
    console: "inherit",
    sandbox: {},
    timeout: 2000,            // 2 s hard cap
    eval: false, wasm: false
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
