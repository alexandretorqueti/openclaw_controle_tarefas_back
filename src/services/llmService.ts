// src/services/llmService.js

const axios = require('axios');
const { extractJsonObjects } = require('../utils/jsonUtils'); // Usando seu utilitário

class LlmService {
  constructor(model = 'phi4:latest', endpoint = 'http://localhost:11434/api/generate') {
    this.endpoint = endpoint; // Ajuste para o seu provedor
    this.model = model;
  }
  // Retiro o 'ollama/' do model
  async analyze(prompt) {
    try {
      const response = await axios.post(this.endpoint, {
        model: this.model.replace(/^ollama\//, ''),
        prompt: prompt,
        stream: false,
        format: "json"
      });

      const rawText = response.data.response || response.data.thinking || '';
      
      // Usa o seu extrator para garantir que pegamos apenas o objeto JSON
      // mesmo que a IA responda com "Aqui está o json: { ... }"
      const foundObjects = extractJsonObjects(rawText);
      
      return foundObjects.length > 0 ? foundObjects[0] : null;
    } catch (error) {
      console.error("❌ Falha crítica no LlmService:", error.message);
      return null;
    }
  }
}

module.exports = LlmService;

