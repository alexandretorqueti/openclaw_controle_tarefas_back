// src/services/taskAnalysisService.js
// Servico de analise de escopo e tipo de tarefas

const { formatNumberedList, formatInlineList } = require('../utils/formatUtils');

// src/services/taskAnalysisService.js
const llmService = require('./llmService');

class TaskAnalysisService {
  static lastAnalysis = null;
  static async analyzeTaskScope(task, project) {
    const prompt = `
      Você é um arquiteto de software. Analise a tarefa abaixo e defina o escopo de execução.
      
      PROJETO:
      - Base: ${project?.pastaBase}
      - Frontend Path: ${project?.frontendPath || 'N/A'}
      - Backend Path: ${project?.backendPath || 'N/A'}

      TAREFA:
      - Título: ${task.title}
      - Descrição: ${task.description}

      REGRAS:
      1. Se a tarefa pede para criar/alterar/corrigir código, o tipo é 'development'.
      2. Se pede apenas para explicar/documentar/analisar sem mudar arquivos, é 'analysis'.
      3. Se é uma tarefa de script/limpeza/execução repetitiva, é 'automation'.
      4. Se requer um relatório detalhado ou passo a passo, marque "requiresReport" como true.

      Responda EXCLUSIVAMENTE em JSON com este formato:
      {
        "taskType": "development" | "analysis" | "automation",
        "requiresReport": true | false,
        "expectedLayers": ["frontend", "backend"],
        "requiredModifiedLayers": ["backend"],
        "mandatoryChecks": ["passo 1", "passo 2"],
        "risks": ["risco 1"]
      }
    `;

    // Chama a IA local
    const analysis = await llmService.analyze(prompt);

    // Fallback caso a IA falhe
    if (!analysis) {
      return this.getFallbackScope(task); 
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

