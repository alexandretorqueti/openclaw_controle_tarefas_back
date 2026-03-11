// src/services/llmService.js
const axios = require('axios');
const { extractJsonObjects } = require('../utils/jsonUtils'); // Usando seu utilitário

class LlmService {
  constructor() {
    this.endpoint = 'http://localhost:11434/api/generate'; // Ajuste para o seu provedor
    this.model = 'qwen2.5-coder:14b'; 
  }

  async analyze(prompt) {
    try {
      const response = await axios.post(this.endpoint, {
        model: this.model,
        prompt: prompt,
        stream: false,
        format: "json"
      });

      const rawText = response.data.response;
      
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

module.exports = new LlmService();