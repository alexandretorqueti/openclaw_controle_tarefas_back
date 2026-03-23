// src/services/llmService.js
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const axios = require('axios');
const { extractJsonObjects } = require('../utils/jsonUtils'); // Usando seu utilitário
class LlmService {
    constructor(model = 'phi4:latest', endpoint = 'http://localhost:11434/api/generate') {
        this.endpoint = endpoint; // Ajuste para o seu provedor
        this.model = model;
    }
    // Retiro o 'ollama/' do model
    analyze(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios.post(this.endpoint, {
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
            }
            catch (error) {
                console.error("❌ Falha crítica no LlmService:", error.message);
                return null;
            }
        });
    }
}
module.exports = LlmService;
