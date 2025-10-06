# Curlime

**Curlime** is a modern, AI text editor with a beautiful, responsive Electron UI. It leverages LLMs for code generation and provides a safe, interactive playground for running and testing code transforms on your own text.

---

## ✨ Features

- **AI Code Generation**: Generate JavaScript or Python code transforms from natural language prompts using LLMs.
  - Cloud: Anthropic Claude
  - Local (no cloud): Ollama (default)
- **Safe Code Execution**: Run generated code in a secure Node.js sandbox (vm2) directly from the app.
- **Modern UI**: Clean, responsive, and beautiful interface with dark code panels, clear labels, and intuitive layout.
- **Copy-to-Clipboard**: Instantly copy input, prompt, result, or generated code with a single click and visual feedback.
- **Preserves Formatting**: Output panels maintain original text formatting and support scrolling for large content.
- **Full-Screen Experience**: The app stretches to fill your entire screen for maximum productivity.
- **Electron-based**: Cross-platform desktop app with native performance.
- **Custom API Key UI**: Set and manage your Claude API key from the app.
- **Provider Selection**: Switch between Claude and local Ollama.
- **Health Check & Models**: Built-in Ollama health check and available model discovery.

---

## 🚧 Roadmap / Upcoming Features

- [ ] **Save Transformation**: Save generated transformations to reuse next time.
- [ ] **History & Undo**: View and restore previous prompts, inputs, and results.
- [ ] **Export/Import**: Save and load sessions or code snippets.
- [ ] **Drag & Drop**: Support for dropping files as input.
- [ ] **In-app Updates**: Notify users of new versions and features.

---

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **(Optional) Use Claude (cloud):**
   - Click on the Settings button in the app UI and save your Anthropic API key
3. **(Recommended) Use Ollama locally (no cloud):**
   - Install Ollama: see `https://ollama.com`
   - Start the Ollama server:
     ```bash
     ollama serve
     ```
   - Pull a model (default expected model):
     ```bash
     ollama pull deepseek-coder:6.7b
     ```
   - You can change the model or server via environment variables (see Configuration below).
4. **Run the app:**
   ```bash
   npm start
   ```

If Ollama is not running, you'll see a warning in the console with quick steps to start it.

---

## ⚙️ Configuration

- `OLLAMA_URL`: URL of the local Ollama server
  - Default: `http://localhost:11434`
- `OLLAMA_MODEL`: Model name to use with Ollama
  - Default: `deepseek-coder:6.7b`

Example:
```bash
export OLLAMA_URL=http://localhost:11434
export OLLAMA_MODEL=codellama:7b
npm start
```

---

## 🛠️ Tech Stack
- Electron
- Anthropic Claude API
- Ollama (local LLM runtime)
- Node.js (with vm2 sandbox)
- Modern HTML/CSS/JS

---

## 💡 Contributing
Pull requests and suggestions are welcome! See the roadmap above for ideas, or open an issue to discuss new features.

---

## 📜 License
MIT 
