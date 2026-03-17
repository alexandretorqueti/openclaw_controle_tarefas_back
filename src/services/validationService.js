const LlmService = require('./llmService');

/**
 * Serviço de validação de atomicidade de tarefas
 * Utiliza LLM (Ollama) para determinar se uma tarefa é atômica
 */
class ValidationService {
  constructor() {
    this.cache = new Map(); // Cache simples para validações
    this.defaultModel = 'phi4:latest';
    this.timeoutMs = 30000; // 30 segundos timeout
    this.logger = this.createLogger();
  }

  /**
   * Cria logger compatível (usa console se logger não estiver disponível)
   */
  createLogger() {
    try {
      const logger = require('../utils/logger');
      // Verificar se o logger tem os métodos necessários
      if (typeof logger.info === 'function' && typeof logger.error === 'function') {
        return logger;
      }
    } catch (error) {
      // Fallback para console
    }
    
    return {
      info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
      error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
      warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
      debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args)
    };
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
        this.logger.debug(`Usando cache para validação da tarefa ${task.id}`);
        return cached.result;
      }

      // Determinar modelo a ser usado
      const model = project.modeloAuxiliar || this.defaultModel;
      this.logger.info(`Validando tarefa ${task.id} com modelo ${model}`);

      // Criar instância do LlmService
      let ollama;
      try {
        ollama = new LlmService(model);
      } catch (error) {
        this.logger.warn(`Erro ao criar LlmService com modelo ${model}:`, error);
        return this.getFallbackValidation(task);
      }

      // Construir prompt otimizado
      const prompt = this.buildValidationPrompt(task, project);
      
      // Executar análise com timeout
      let llmResponse;
      try {
        llmResponse = await this.callWithTimeout(
          () => ollama.analyze(prompt),
          this.timeoutMs,
          `Timeout na validação da tarefa ${task.id}`
        );
      } catch (error) {
        this.logger.error(`Erro na chamada LLM para tarefa ${task.id}:`, error);
        return this.getFallbackValidation(task);
      }

      // Processar resposta do LLM
      const validationResult = this.parseLlmResponse(llmResponse, task);
      
      // Adicionar ao cache
      this.cache.set(cacheKey, {
        result: validationResult,
        timestamp: Date.now()
      });

      this.logger.info(`Validação concluída para tarefa ${task.id}: isAtomic=${validationResult.isAtomic}`);
      return validationResult;

    } catch (error) {
      this.logger.error(`Erro na validação da tarefa ${task.id}:`, error);
      return this.getFallbackValidation(task, error.message);
    }
  }

  /**
   * Constrói prompt para validação de atomicidade
   * @param {Object} task - Tarefa
   * @param {Object} project - Projeto
   * @returns {string} Prompt formatado
   */
  buildValidationPrompt(task, project) {
    return `Você é um Juiz de Atômica especializado em análise de tarefas de desenvolvimento de software.

ANÁLISE DE TAREFA - CRITÉRIOS DE ATÔMICIDADE:

Uma tarefa é considerada ATÔMICA quando:
1. Tem objetivo claro e específico
2. Possui instruções passo a passo executáveis
3. Tem entrada e saída bem definidas
4. Pode ser realizada por um estagiário sem necessidade de decisões arquiteturais
5. Tem escopo limitado (pode ser concluída em poucas horas)
6. Não depende de outras tarefas não concluídas
7. Tem critérios de aceitação claros

INFORMAÇÕES DA TAREFA:
- Título: ${task.title}
- Descrição: ${task.description}
- Projeto: ${project.name}
- Domínio: ${task.domain || 'Não especificado'}

INFORMAÇÕES ADICIONAIS:
- Tipo de Projeto: ${project.projectType?.name || 'Não especificado'}
- Regras do Projeto: ${project.regras ? project.regras.substring(0, 200) + '...' : 'Não especificadas'}

ANÁLISE REQUERIDA:
1. Esta tarefa está pronta para um estagiário executar?
2. A tarefa tem arquivo e instrução clara?
3. O escopo é limitado e bem definido?

FORMATO DE RESPOSTA OBRIGATÓRIO:
Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "isAtomic": boolean,
  "reason": "string (explicação detalhada)",
  "confidence": number (0.0 a 1.0),
  "suggestions": ["sugestão 1", "sugestão 2"]
}

EXEMPLOS:
- Tarefa atômica: {"isAtomic": true, "reason": "Tarefa tem objetivo claro: criar componente React com props definidas. Instruções são específicas e executáveis.", "confidence": 0.9, "suggestions": []}
- Tarefa não atômica: {"isAtomic": false, "reason": "Tarefa muito ampla: 'melhorar performance do sistema'. Falta especificação de quais métricas melhorar e como medir.", "confidence": 0.8, "suggestions": ["Dividir em subtarefas menores", "Definir métricas específicas"]}

RESPOSTA (APENAS JSON):`;
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
      this.logger.warn(`Erro ao processar resposta LLM: ${error.message}. Resposta: ${JSON.stringify(llmResponse)}`);
      
      // Fallback: análise heurística simples
      return this.heuristicValidation(task);
    }
  }

  /**
   * Validação heurística de fallback
   * @param {Object} task - Tarefa
   * @returns {Object} Resultado heurístico
   */
  heuristicValidation(task) {
    const title = task.title || '';
    const description = task.description || '';
    
    // Heurísticas simples
    const hasClearObjective = title.length > 5 && description.length > 20;
    const hasSpecificInstructions = description.includes('criar') || 
                                   description.includes('implementar') || 
                                   description.includes('adicionar');
    const isTooVague = title.includes('melhorar') || 
                      title.includes('otimizar') || 
                      title.includes('refatorar');
    
    const isAtomic = hasClearObjective && hasSpecificInstructions && !isTooVague;
    
    return {
      isAtomic,
      reason: isAtomic 
        ? 'Tarefa parece ter objetivo específico baseado em heurística' 
        : 'Tarefa muito vaga ou falta especificação detalhada',
      confidence: 0.5,
      suggestions: isAtomic ? [] : ['Adicionar instruções mais específicas', 'Definir critérios de aceitação'],
      source: 'heuristic',
      taskId: task.id,
      timestamp: new Date().toISOString()
    };
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
      this.logger.info(`Cache limpo: removidas entradas com mais de ${maxAgeMs}ms`);
    } else {
      this.cache.clear();
      this.logger.info('Cache limpo completamente');
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
        this.logger.error(`Erro na validação em lote da tarefa ${task.id}:`, error);
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