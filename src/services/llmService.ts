// src/services/LlmService.ts

import axios from 'axios';
import { extractJsonObjects } from '../utils/jsonUtils';

class LlmService {
  private endpoint: string;
  private model: string;

  /**
   * Construtor do serviço de LLM Local (Ollama/LM Studio)
   * @param model Nome do modelo (ex: phi4, qwen2.5-coder)
   * @param endpoint URL da API de geração
   */
  constructor(model = 'phi4:latest', endpoint = 'http://localhost:11434/api/generate') {
    this.endpoint = endpoint;
    this.model = model;
  }

  /**
   * Envia um prompt para o modelo e extrai o JSON da resposta
   * @param prompt O texto de instrução para a IA
   * @returns O primeiro objeto JSON encontrado ou null
   */
  async analyze(prompt: string): Promise<any> {
    try {
      // Limpa o prefixo 'ollama/' caso venha na configuração
      const modelName = this.model.replace(/^ollama\//, '');

      const response = await axios.post(this.endpoint, {
        model: modelName,
        prompt: prompt,
        stream: false,
        format: "json" // Força o Ollama a estruturar a saída
      });

      // Alguns provedores usam 'response', outros 'thinking' ou 'content'
      const rawText = response.data.response || response.data.message?.content || response.data.thinking || '';
      
      // Usa o seu utilitário robusto para extrair o JSON 
      // (Ignora lixo textual que a IA possa colocar antes ou depois)
      const foundObjects = extractJsonObjects(rawText);
      
      if (foundObjects && foundObjects.length > 0) {
        return foundObjects[0];
      }

      console.warn(`⚠️ [LlmService] Nenhum JSON válido encontrado na resposta do modelo ${modelName}`);
      return null;

    } catch (error: any) {
      console.error("❌ [LlmService] Falha crítica na comunicação com o provedor de LLM:", error.message);
      
      // Se for erro de conexão (ECONNREFUSED), vale um log mais amigável
      if (error.code === 'ECONNREFUSED') {
        console.error("🚨 Verifique se o Ollama ou o LM Studio está rodando no endpoint:", this.endpoint);
      }
      
      return null;
    }
  }
}

export default LlmService;