# Curlime

**Curlime** is a modern, AI text editor with a beautiful, responsive Electron UI. It leverages LLMs for code generation and provides a safe, interactive playground for running and testing code transforms on your own text.

---

## ✨ Features

- **AI Code Generation**: Generate JavaScript or Python code transforms from natural language prompts using LLMs, currently use Anthropic Claude.
- **Safe Code Execution**: Run generated code in a secure Node.js sandbox (vm2) directly from the app.
- **Modern UI**: Clean, responsive, and beautiful interface with dark code panels, clear labels, and intuitive layout.
- **Copy-to-Clipboard**: Instantly copy input, prompt, result, or generated code with a single click and visual feedback.
- **Preserves Formatting**: Output panels maintain original text formatting and support scrolling for large content.
- **Full-Screen Experience**: The app stretches to fill your entire screen for maximum productivity.
- **Electron-based**: Cross-platform desktop app with native performance.
- **Custom API Key UI**: Set and manage your API key from the app.

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
2. **Set your Anthropic Claude API key:**
   - Click on Setting button in the app UI and save your API key
3. **Run the app:**
   ```bash
   npm start
   ```

---

## 🛠️ Tech Stack
- Electron
- Anthropic Claude API
- Node.js (with vm2 sandbox)
- Modern HTML/CSS/JS

---

## 💡 Contributing
Pull requests and suggestions are welcome! See the roadmap above for ideas, or open an issue to discuss new features.

---

## 📜 License
MIT 
