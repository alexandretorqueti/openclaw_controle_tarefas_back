// ValidationService.js

const LlmService = require('./llmService');
const buildValidationPrompt = require('../utils/promptFactory').buildValidationPrompt;
/**
 * Serviço de validação de atomicidade de tarefas
 * Utiliza LLM (Ollama) para determinar se uma tarefa é atômica
 */
class ValidationService {
  constructor() {
    this.cache = new Map(); // Cache simples para validações
    this.defaultModel = 'phi4:latest';
    this.timeoutMs = 5 * 60 * 1000; // 5 minutos
    this.logger = this.createLogger();
  }

  /**
   * Cria logger compatível (usa console se logger não estiver disponível)
   */
  createLogger() {
    try {
      const { Logger, LOG_LEVELS } = require('../utils/logger');
      
      // Como os métodos são estáticos, usamos a própria classe Logger, não uma instância
      return {
        logInfo: (message) => {
          if (typeof Logger.logInfo === 'function') {
            return Logger.logInfo({ message, level: LOG_LEVELS.INFO });
          }
          console.log(`[INFO] ${message}`);
        },
        logError: (message, error) => {
          if (typeof Logger.createLog === 'function') {
            return Logger.createLog({ 
              message: `${message} ${error?.message || ''}`, 
              level: LOG_LEVELS.ERROR,
              stackTrace: error?.stack 
            });
          }
          console.error(`[ERROR] ${message}`, error);
        },
        logWarning: (message) => {
          if (typeof Logger.logWarning === 'function') {
            return Logger.logWarning({ message, level: LOG_LEVELS.WARN });
          }
          console.warn(`[WARN] ${message}`);
        },
        logDebug: (message) => {
          console.debug(`[DEBUG] ${message}`);
        }
      };
    } catch (error) {
      // Fallback para console
      return {
        logInfo: (message) => console.log(`[INFO] ${message}`),
        logError: (message, error) => console.error(`[ERROR] ${message}`, error),
        logWarning: (message) => console.warn(`[WARN] ${message}`),
        logDebug: (message) => console.debug(`[DEBUG] ${message}`)
      };
    }
  }

  /**
   * Valida se uma tarefa é atômica usando modelo auxiliar
   * @param {Object} task - Objeto da tarefa
   * @param {Object} project - Objeto do projeto
   * @returns {Promise<Object>} Resultado da validação {isAtomic, reason, confidence}
   */
  async validateWithAuxModel(task, project) {
    try {
      // Validações iniciais
      if (!task || !project) {
        throw new Error('task e project são obrigatórios');
      }

      if (!task.title || !task.description) {
        return {
          isAtomic: false,
          reason: 'Tarefa sem título ou descrição suficiente',
          confidence: 0,
          error: 'Dados insuficientes'
        };
      }

      // Verificar cache (opcional)
      const cacheKey = `${task.id}_${project.id}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hora de cache
        this.logger.logInfo(`Usando cache para validação da tarefa ${task.id}`);
        return cached.result;
      }

      // Determinar modelo a ser usado
      const model = project.modeloAuxiliar || this.defaultModel;
      this.logger.logInfo(`Validando tarefa ${task.id} com modelo ${model}`);

      // Criar instância do LlmService
      let ollama;
      try {
        ollama = new LlmService(model);
      } catch (error) {
        this.logger.logWarning(`Erro ao criar LlmService com modelo ${model}:`, error);
        return this.getFallbackValidation(task);
      }

      // Construir prompt otimizado
      const prompt = buildValidationPrompt(task, project);
      
      // Executar análise com timeout
      let llmResponse;
      try {
        llmResponse = await this.callWithTimeout(
          () => ollama.analyze(prompt),
          this.timeoutMs,
          `Timeout na validação da tarefa ${task.id}`
        );
      } catch (error) {
        this.logger.logError(`Erro na chamada LLM para tarefa ${task.id}:`, error);
        return this.getFallbackValidation(task);
      }

      // Processar resposta do LLM
      const validationResult = this.parseLlmResponse(llmResponse, task);
      
      // Adicionar ao cache
      this.cache.set(cacheKey, {
        result: validationResult,
        timestamp: Date.now()
      });

      this.logger.logInfo(`Validação concluída para tarefa ${task.id}: isAtomic=${validationResult.isAtomic}`);
      return validationResult;

    } catch (error) {
      this.logger.logError(`Erro na validação da tarefa ${task.id}:`, error);
      return this.getFallbackValidation(task, error.message);
    }
  }
 

  /**
   * Processa a resposta do LLM
   * @param {Object} llmResponse - Resposta do LLM (objeto JSON)
   * @param {Object} task - Tarefa original
   * @returns {Object} Resultado validado
   */
  parseLlmResponse(llmResponse, task) {
    try {
      // Se a resposta for null (erro no LlmService)
      if (!llmResponse) {
        throw new Error('Resposta do LLM é null');
      }
      // Se llmResponse for string, tentar converter para JSON
      if (typeof llmResponse === 'string') {
        llmResponse = JSON.parse(llmResponse);
      }
      // Validar estrutura do resultado
      if (typeof llmResponse.isAtomic !== 'boolean') {
        throw new Error('Campo isAtomic não é booleano');
      }
      
      if (!llmResponse.reason || typeof llmResponse.reason !== 'string') {
        llmResponse.reason = 'Razão não fornecida pelo modelo';
      }
      
      if (typeof llmResponse.confidence !== 'number' || llmResponse.confidence < 0 || llmResponse.confidence > 1) {
        llmResponse.confidence = llmResponse.isAtomic ? 0.7 : 0.5;
      }
      
      if (!Array.isArray(llmResponse.suggestions)) {
        llmResponse.suggestions = [];
      }
      
      return {
        isAtomic: llmResponse.isAtomic,
        reason: llmResponse.reason,
        confidence: llmResponse.confidence,
        suggestions: llmResponse.suggestions,
        source: 'llm',
        taskId: task.id,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.logError(`Erro ao processar resposta LLM: ${error.message}. Resposta: ${JSON.stringify(llmResponse)}`);
      
      // retorna Erro
      throw new Error(`Erro ao processar resposta LLM: ${error.message}`);
    }
  }

  /**
   * Validação de fallback quando LLM falha
   * @param {Object} task - Tarefa
   * @param {string} error - Mensagem de erro
   * @returns {Object} Resultado de fallback
   */
  getFallbackValidation(task, error = 'Serviço LLM indisponível') {
    return {
      isAtomic: false,
      reason: `Não foi possível validar atomicidade: ${error}`,
      confidence: 0,
      suggestions: ['Verificar conexão com Ollama', 'Usar validação manual'],
      source: 'fallback',
      taskId: task.id,
      timestamp: new Date().toISOString(),
      error: error
    };
  }

  /**
   * Executa função com timeout
   * @param {Function} fn - Função a executar
   * @param {number} timeoutMs - Timeout em milissegundos
   * @param {string} timeoutMessage - Mensagem de timeout
   * @returns {Promise<any>} Resultado da função
   */
  async callWithTimeout(fn, timeoutMs, timeoutMessage) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      )
    ]);
  }

  /**
   * Limpa o cache de validações
   * @param {number} maxAgeMs - Idade máxima em milissegundos (opcional)
   */
  clearCache(maxAgeMs) {
    if (maxAgeMs) {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > maxAgeMs) {
          this.cache.delete(key);
        }
      }
      this.logger.logInfo(`Cache limpo: removidas entradas com mais de ${maxAgeMs}ms`);
    } else {
      this.cache.clear();
      this.logger.logInfo('Cache limpo completamente');
    }
  }

  /**
   * Valida múltiplas tarefas em lote
   * @param {Array} tasks - Array de tarefas
   * @param {Object} project - Projeto
   * @returns {Promise<Array>} Resultados das validações
   */
  async validateBatch(tasks, project) {
    const results = [];
    
    for (const task of tasks) {
      try {
        const result = await this.validateWithAuxModel(task, project);
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          ...result
        });
      } catch (error) {
        this.logger.logError(`Erro na validação em lote da tarefa ${task.id}:`, error);
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          isAtomic: false,
          reason: `Erro na validação: ${error.message}`,
          confidence: 0,
          source: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = new ValidationService();