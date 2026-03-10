// src/services/taskAnalysisService.js
// Servico de analise de escopo e tipo de tarefas

const { formatNumberedList, formatInlineList } = require('../utils/formatUtils');

class TaskAnalysisService {
  /**
   * Detecta o tipo de tarefa baseado no titulo e descricao
   * @param {Object} task - Tarefa a analisar
   * @returns {string} - 'analysis', 'development', ou 'automation'
   */
  static detectTaskType(task) {
    const text = `${task?.title || ''}\n${task?.description || ''}`.toLowerCase();

    if (
      /(análise|analise|documenta|diagnóstic|diagnostic|levantamento|mapeamento|passo a passo|explique|descreva|resuma|gere um texto|retorne um texto)/i.test(text)
    ) {
      return 'analysis';
    }

    if (
      /(implementar|corrigir|ajustar|refatorar|alterar|adicionar|criar endpoint|endpoint|controller|service|validator|frontend|backend|api|build|tela|componente|campo|schema|migration|migrat)/i.test(text)
    ) {
      return 'development';
    }

    return 'automation';
  }

  /**
   * Verifica se a tarefa requer relatorio
   * @param {Object} task - Tarefa a analisar
   * @returns {boolean}
   */
  static requiresReport(task) {
    const text = `${task?.title || ''}\n${task?.description || ''}`.toLowerCase();

    return /(relatório|relatorio|gere um texto|retorne um texto|passo a passo|documente|explique|descreva|resuma|diagnóstico|diagnostico)/i.test(text);
  }

  /**
   * Analisa o escopo completo de uma tarefa
   * @param {Object} task - Tarefa a analisar
   * @param {Object} project - Projeto associado
   * @returns {Object}
   */
  static analyzeTaskScope(task, project) {
    const rawText = `${task?.title || ''}\n${task?.description || ''}`;
    const text = rawText.toLowerCase();

    const baseTaskType = this.detectTaskType(task);

    const expectedLayers = new Set();
    const requiredModifiedLayers = new Set();
    const mandatoryChecks = [];
    const definitionOfDone = [];
    const risks = [];
    const finalizationInstructions = [
      'Escrever o resultado final no arquivo de relatorio.',
      'Criar o arquivo .done ao finalizar.'
    ];

    const hasFrontendPath = !!project?.frontendPath;
    const hasBackendPath = !!project?.backendPath;

    const mentionsFrontend =
      /(frontend|formulário|formulario|tela|ui|componente|input|select|checkbox|modal|página|pagina|view)/i.test(text);

    const mentionsBackend =
      /(backend|api|controller|service|model|schema|dto|validator|prisma|migration|migrat|banco|repository|repositório)/i.test(text);

    const mentionsCrudFields =
      /(campo|campos|cadastro|inclusão|inclusao|edição|edicao|formulário|formulario|create|edit|criação|criacao|atualização|atualizacao)/i.test(text);

    const mentionsAnalysis =
      /(análise|analise|documenta|diagnóstic|diagnostic|levantamento|mapeamento|passo a passo|explique|descreva|resuma|gere um texto|retorne um texto)/i.test(text);

    const mentionsListingOrDetails =
      /(listagem|detalhe|detalhes|visualização|visualizacao|consulta|exibição|exibicao)/i.test(text);

    const mentionsProjectRegistration =
      /(projeto|projetos)/i.test(text) && mentionsCrudFields;

    // Analise de tarefas de ANALISE
    if (baseTaskType === 'analysis' || mentionsAnalysis) {
      return {
        taskType: 'analysis',
        expectedLayers: [],
        requiredModifiedLayers: [],
        mandatoryChecks: [
          'Localizar os arquivos ou diretorios relevantes.',
          'Ler ou inspecionar as partes necessarias do sistema.',
          'Produzir um relatorio final consistente com base no que foi realmente inspecionado.'
        ],
        definitionOfDone: [
          'Ha evidencia real de inspecao do sistema.',
          'O relatorio final foi escrito.',
          'O arquivo .done foi criado.'
        ],
        finalizationInstructions,
        risks: [
          'Nao concluir so com texto generico sem evidencia de leitura ou inspecao.'
        ]
      };
    }

    // Analise de tarefas de DESENVOLVIMENTO
    if (baseTaskType === 'development') {
      if (mentionsBackend) expectedLayers.add('backend');
      if (mentionsFrontend) expectedLayers.add('frontend');

      if (mentionsCrudFields) {
        if (hasBackendPath) expectedLayers.add('backend');
        if (hasFrontendPath) expectedLayers.add('frontend');
      }

      if (expectedLayers.size === 0) {
        if (hasBackendPath) expectedLayers.add('backend');
        else if (hasFrontendPath) expectedLayers.add('frontend');
      }

      if (mentionsBackend && hasBackendPath) requiredModifiedLayers.add('backend');
      if (mentionsFrontend && hasFrontendPath) requiredModifiedLayers.add('frontend');

      if (mentionsProjectRegistration || mentionsCrudFields) {
        if (hasBackendPath) requiredModifiedLayers.add('backend');
        if (hasFrontendPath) requiredModifiedLayers.add('frontend');
      }

      if (requiredModifiedLayers.size === 0 && expectedLayers.size === 1) {
        for (const layer of expectedLayers) {
          requiredModifiedLayers.add(layer);
        }
      }

      if (expectedLayers.has('backend')) {
        mandatoryChecks.push('Localizar e revisar os arquivos do backend afetados.');
        mandatoryChecks.push('Atualizar modelo/schema/DTO/validacao/service/controller quando aplicavel.');
        mandatoryChecks.push('Garantir que create/edit do backend aceitem e persistam a mudanca.');
      }

      if (expectedLayers.has('frontend')) {
        mandatoryChecks.push('Localizar e revisar os arquivos do frontend afetados.');
        mandatoryChecks.push('Atualizar formulario de inclusao/criacao quando aplicavel.');
        mandatoryChecks.push('Atualizar formulario de edicao quando aplicavel.');
      }

      if (mentionsListingOrDetails && expectedLayers.has('frontend')) {
        mandatoryChecks.push('Verificar se telas de listagem/detalhes tambem precisam refletir a mudanca.');
      }

      definitionOfDone.push('Arquivos reais do projeto foram alterados.');
      definitionOfDone.push('O relatorio final foi escrito.');
      definitionOfDone.push('O arquivo .done foi criado.');
      definitionOfDone.push('A tarefa passou na validacao final do orquestrador.');

      if (requiredModifiedLayers.has('backend')) {
        definitionOfDone.push('Ha alteracao real em arquivos do backend.');
      }

      if (requiredModifiedLayers.has('frontend')) {
        definitionOfDone.push('Ha alteracao real em arquivos do frontend.');
      }

      if (!hasFrontendPath && (mentionsFrontend || mentionsCrudFields)) {
        risks.push('A tarefa parece afetar frontend, mas o projeto nao tem frontendPath configurado.');
      }

      if (!hasBackendPath && (mentionsBackend || mentionsCrudFields)) {
        risks.push('A tarefa parece afetar backend, mas o projeto nao tem backendPath configurado.');
      }

      if (risks.length === 0) {
        risks.push('Nao concluir a tarefa sem revisar todas as camadas impactadas.');
      }

      return {
        taskType: 'development',
        expectedLayers: Array.from(expectedLayers),
        requiredModifiedLayers: Array.from(requiredModifiedLayers),
        mandatoryChecks,
        definitionOfDone,
        finalizationInstructions,
        risks
      };
    }

    // Tarefas de AUTOMACAO
    const automationChecks = [
      'Executar as acoes necessarias para cumprir a automacao.',
      'Gerar o relatorio final quando solicitado.',
      'Finalizar com o arquivo .done.'
    ];

    const automationDone = [
      'Ha evidencia de execucao util.',
      'O arquivo .done foi criado.'
    ];

    if (this.requiresReport(task)) {
      automationDone.push('O relatorio final foi escrito.');
    }

    return {
      taskType: 'automation',
      expectedLayers: [],
      requiredModifiedLayers: [],
      mandatoryChecks: automationChecks,
      definitionOfDone: automationDone,
      finalizationInstructions,
      risks: ['Nao concluir sem evidencia real de execucao util.']
    };
  }

  /**
   * Gera bloco de analise de escopo formatado para o prompt
   * @param {Object} analysisPlan - Plano de analise
   * @returns {string}
   */
  static formatScopeAnalysisBlock(analysisPlan) {
    return `
[PRE-ANALISE DE ESCOPO]
Tipo detectado: ${analysisPlan.taskType}
Camadas esperadas: ${formatInlineList(analysisPlan.expectedLayers, 'nenhuma')}
Camadas que DEVEM ter alteracao real: ${formatInlineList(analysisPlan.requiredModifiedLayers, 'nenhuma obrigatoria')}

Checklist obrigatorio:
${formatNumberedList(analysisPlan.mandatoryChecks)}

Definicao de pronto:
${formatNumberedList(analysisPlan.definitionOfDone)}

Instrucoes de finalizacao:
${formatNumberedList(analysisPlan.finalizationInstructions)}

Riscos comuns:
${formatNumberedList(analysisPlan.risks)}
`;
  }
}

module.exports = TaskAnalysisService;
