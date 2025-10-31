// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Generate code with full config object (matches main process handler)
  generateCode: (input, prompt, lang, config) => ipcRenderer.invoke('generate-code', input, prompt, lang, config),

  // Execute generated JS against input
  runJS: (code, input) => ipcRenderer.invoke('run-js', code, input),

  // Backend/Provider utilities
  checkBackendHealth: () => ipcRenderer.invoke('check-backend-health'),
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  testClaudeConnection: (apiKey) => ipcRenderer.invoke('test-claude-connection', apiKey),

  // Persistence for executed versions
  saveExecutedVersion: (payload) => ipcRenderer.invoke('save-executed-version', payload),
  listExecutedVersions: (limit) => ipcRenderer.invoke('list-executed-versions', limit),
  listTransforms: () => ipcRenderer.invoke('list-transforms'),
  createTransform: (payload) => ipcRenderer.invoke('create-transform', payload),
  getTransform: (id) => ipcRenderer.invoke('get-transform', id),
  updateTransform: (id, fields) => ipcRenderer.invoke('update-transform', id, fields),
  deleteTransform: (id) => ipcRenderer.invoke('delete-transform', id)
});
