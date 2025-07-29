// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  generateCode: (input, prompt, lang) => {
    // Get the key from localStorage in the renderer context
    const apiKey = localStorage.getItem('anthropic_api_key') || '';
    return ipcRenderer.invoke('generate-code', input, prompt, lang, apiKey);
  },
  runJS: (code, input) => ipcRenderer.invoke('run-js', code, input)
});
