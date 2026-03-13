// src/services/taskAnalysisService.js
// Servico de analise de escopo e tipo de tarefas
const promptFactory = require('../utils/promptFactory');
const LlmService = require('./llmService');
const llmService = new LlmService('llama3.1:latest', 'http://localhost:11434/api/generate'); // Especifica o modelo que deseja usar


class TaskAnalysisService {
  static lastAnalysis = null;
  static async analyzeTaskScope(task, project) {
    const prompt = promptFactory.buildTaskAnalysisPrompt(task, project);

    // Chama a IA local
    let analysis = await llmService.analyze(prompt);

    // Fallback caso a IA falhe
    if (!analysis) {
      return this.getFallbackScope(task); 
    }

    // Se analysis for string, tenta parsear como JSON
    
    if (typeof analysis === 'string') {
      try {
        analysis = JSON.parse(analysis);
      } catch (e) {
        console.warn("⚠️ Falha ao parsear análise da IA, usando fallback:", e.message);
        return this.getFallbackScope(task);
      }
    }
    // Injeta instruções padrão de finalização
    analysis.finalizationInstructions = [
      'Escrever o resultado final no arquivo de relatorio.',
      'Criar o arquivo .done ao finalizar.'
    ];
    analysis.definitionOfDone = analysis.mandatoryChecks.map(c => `Concluído: ${c}`);

    return analysis;
  }

  static getFallbackScope(task) {
    const needsReport = this.requiresReport(task); // Usa o método acima
    // Retorna um objeto padrão seguro caso a chamada à IA falhe
    return {
      taskType: 'automation',
      requiresReport: needsReport,
      expectedLayers: [],
      requiredModifiedLayers: [],
      mandatoryChecks: [
        'Executar as ações necessárias para cumprir a tarefa.',
        'Verificar se o objetivo principal foi atingido.'
      ],
      definitionOfDone: [
        'Evidência de execução detectada.',
        'Arquivo .done criado.'
      ],
      finalizationInstructions: [
        'Escrever o resultado final no arquivo de relatorio.',
        'Criar o arquivo .done ao finalizar.'
      ],
      risks: ['Falha na análise inteligente: executando em modo de compatibilidade.']
    };
  }

  /**
   * AGORA COMPATÍVEL: Retorna o valor decidido pela IA, 
   * ou usa o Regex como fallback se a IA ainda não tiver sido chamada.
   */
  static requiresReport(task) {
    // Se a IA já rodou e temos o resultado, usamos ele (Prioridade Total)
    if (this.lastAnalysis && typeof this.lastAnalysis.requiresReport !== 'undefined') {
      return this.lastAnalysis.requiresReport;
    }

    // Se não temos análise (ou antes da IA rodar), usamos o Regex (Compatibilidade)
    const text = `${task?.title || ''}\n${task?.description || ''}`.toLowerCase();
    return /(relatório|relatorio|gere um texto|retorne um texto|passo a passo|documente|explique|descreva|resuma|diagnóstico|diagnostico)/i.test(text);
  }

  /**
   * Analisa a resposta do arquiteto para determinar se:
   * 1. Já executou a tarefa
   * 2. Gerou um plano para execução
   * 3. Não conseguiu analisar
   * @param {string} architectResponse - Resposta do arquiteto
   * @param {Object} task - Tarefa original
   * @param {Object} project - Projeto
   * @returns {Promise<Object>} Análise estruturada
   */
  static async analyzeArchitectResponse(architectResponse, task, project) {
    if (!architectResponse || architectResponse.trim() === '') {
      return {
        hasExecuted: false,
        hasPlan: false,
        confidence: 0,
        executionDetails: null,
        planDetails: null,
        analysisFailed: true
      };
    }

    const prompt = promptFactory.buildArchitectAnalysisPrompt(architectResponse, task, project);

    try {
      let analysis = await llmService.analyze(prompt);
      
      if (!analysis) {
        return this.getFallbackArchitectAnalysis(architectResponse);
      }

      if (typeof analysis === 'string') {
        try {
          analysis = JSON.parse(analysis);
        } catch (e) {
          console.warn("⚠️ Falha ao parsear análise da resposta do arquiteto:", e.message);
          return this.getFallbackArchitectAnalysis(architectResponse);
        }
      }

      // Validação básica da estrutura
      if (typeof analysis.hasExecuted !== 'boolean' || typeof analysis.hasPlan !== 'boolean') {
        return this.getFallbackArchitectAnalysis(architectResponse);
      }

      return analysis;

    } catch (error) {
      console.warn("⚠️ Erro ao analisar resposta do arquiteto:", error.message);
      return this.getFallbackArchitectAnalysis(architectResponse);
    }
  }

  /**
   * Fallback para análise de resposta do arquiteto (quando LLM falha)
   * @param {string} architectResponse - Resposta do arquiteto
   * @returns {Object} Análise fallback
   */
  static getFallbackArchitectAnalysis(architectResponse) {
    // Fallback simples baseado em regex (aproximação do que tinha antes)
    const response = architectResponse.toLowerCase();
    
    const executionIndicators = [
      /(já (concluí|finalizei|resolvi|executei|fiz|implementei|alterei|modifiquei) (a tarefa|o trabalho|a implementação|o código|os arquivos))/,
      /(tarefa (concluída|finalizada|resolvida|executada|pronta|implementada))/,
      /(código (alterado|modificado|implementado|corrigido|escrito))/,
      /(arquivos? (alterados?|modificados?|criados?|atualizados?|escritos?))/,
      /(alterei.*arquivo|modifiquei.*código|escrevi.*código)/,
      /(pronto para (teste|validação|verificação|entrega))/
    ];

    const planIndicators = [
      /(plano de ação|passo a passo|instruções|diretrizes|recomendações)/,
      /(primeiro.*segundo.*terceiro|passo 1.*passo 2)/,
      /(siga.*estes passos|execute.*os seguintes)/,
      /(recomendo.*sugiro.*aconselho)/
    ];

    const hasExecuted = executionIndicators.some(regex => regex.test(response));
    const hasPlan = planIndicators.some(regex => regex.test(response));
    const analysisFailed = response.trim() === '' || response.includes('não consegui') || response.includes('erro');

    return {
      hasExecuted,
      hasPlan: hasPlan && !hasExecuted, // Se executou, não tem "plano" no sentido de instrução
      confidence: 50, // Baixa confiança no fallback
      executionDetails: hasExecuted ? "Detectado por padrões de texto (fallback)" : null,
      planDetails: hasPlan ? "Detectado por padrões de texto (fallback)" : null,
      analysisFailed
    };
  }
}

module.exports = TaskAnalysisService;


