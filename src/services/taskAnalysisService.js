// src/services/taskAnalysisService.js
// Servico de analise de escopo e tipo de tarefas
const promptFactory = require('../utils/promptFactory');
const { formatNumberedList, formatInlineList } = require('../utils/formatUtils');

// src/services/taskAnalysisService.js
const LlmService = require('./llmService');
const llmService = new LlmService('qwen2.5-coder:32b', 'http://localhost:11434/api/generate'); // Especifica o modelo que deseja usar


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
}

module.exports = TaskAnalysisService;

