// src/services/taskAnalysisService.js
// Servico de analise de escopo e tipo de tarefas
const promptFactory = require('../utils/promptFactory');
const LlmService = require('./llmService');
const llmService = new LlmService('qwen3:4b', 'http://localhost:11434/api/generate'); // Especifica o modelo que deseja usar
const { log } = require('../aux/logger');

class TaskAnalysisService {
  static lastAnalysis = null;

  static async analyzeTaskScope(task, project, preAnalysisFile = null) {
    const prompt = promptFactory.buildTaskAnalysisPrompt(task, project, preAnalysisFile);

    // Chama a IA local
    const modelo = project.modeloAuxiliar || 'qwen3:4b';
    llmService.model = modelo; // Atualiza o modelo do serviço antes de chamar a análise
    let analysis = await llmService.analyze(prompt);
    let analise_texto = '';
    if (analysis && typeof analysis === 'object') {
      analise_texto = JSON.stringify(analysis, null, 2);
    } else if (typeof analysis === 'string') {
      analise_texto = analysis;
    }
    log(`🔍 Análise da IA para a tarefa "${task.title}": ${analise_texto}`);
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
    // Validação defensiva: garantir que analysis tem estrutura esperada
    if (!analysis.mandatoryChecks || !Array.isArray(analysis.mandatoryChecks)) {
      analysis.mandatoryChecks = ['Verificar se a tarefa foi concluída corretamente'];
    }
    
    if (!analysis.taskType) {
      analysis.taskType = 'automation';
    }
    
    if (!analysis.scope) {
      analysis.scope = 'Moderate';
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
  static async analyzeArchitectResponse(architectResponse, task, project, evidences = {}) {
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

    const prompt = promptFactory.buildArchitectAnalysisPrompt(architectResponse, task, project, evidences);

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


  /**
   * Analisa a resposta do desenvolvedor (Jarbas) para entender suas intenções
   * e verificar o cumprimento do protocolo (ex: arquivo .done e relatório).
   */
  static async analyzeDeveloperTurn({ rawOutput, task, evidence, doneExists }) {
    const { TASKS_DIR } = require('../aux/config');


    // 1. Proteção contra retornos vazios
    if (!rawOutput || rawOutput.trim() === '') {
      return {
        isDeclaringDone: false,
        hasFulfilledContract: false,
        missingRequirements: [],
        isTalkingWithoutAction: false
      };
    }

    // 2. Construção do Prompt de Auditoria
    // Dica: limitamos o tamanho do rawOutput para economizar tokens e tempo
    const prompt = `
    Você é um sistema de auditoria avaliando a resposta de um Agente de IA de programação.
    
    === DADOS DA TAREFA ===
    Título: ${task?.title || 'Tarefa Desconhecida'}
    
    === CONTEXTO DO SISTEMA ===
    Arquivo .done existe no disco? ${doneExists ? 'SIM' : 'NÃO'}
    
    === PASTA PARA SALVAR OS ARQUIVOS ===
    ${TASKS_DIR}

    === RESPOSTA DO AGENTE ===
    ${rawOutput.substring(0, 2500)}
    
    === SUA TAREFA ===
    Analise a resposta do agente e retorne EXATAMENTE UM JSON com os seguintes campos:
    {
      "isDeclaringDone": booleano, // true se o agente afirmou explicitamente que terminou a tarefa (ex: "concluído", "terminei", "pronto").
      "isTalkingWithoutAction": booleano, // true se o agente APENAS conversou/planejou e NÃO utilizou nenhum bloco JSON de ferramenta.
      "hasFulfilledContract": booleano, // true APENAS SE isDeclaringDone for true E o "Arquivo .done existe no disco?" for SIM.
      "missingRequirements": [] // Array de strings. Se isDeclaringDone for true mas o contrato não foi cumprido, liste o que falta (Ex: "Falta criar o arquivo .done na pasta ${TASKS_DIR} usando a ferramenta exec").
    }
    
    Responda APENAS com o JSON válido. Não inclua blocos de código markdown (\`\`\`json).
    `;

    try {
      // Chama o seu serviço de LLM (ajuste 'llmService' para o nome exato que você usa na sua classe)
      let analysis = await llmService.analyze(prompt);
      
      if (!analysis) {
        throw new Error("LLM retornou vazio");
      }

      // Tratamento de parse (se o LLM for teimoso e mandar markdown)
      if (typeof analysis === 'string') {
        let cleanJson = analysis.replace(/```json/gi, '').replace(/```/g, '').trim();
        analysis = JSON.parse(cleanJson);
      }

      // Garante que a estrutura de retorno seja sólida
      return {
        isDeclaringDone: !!analysis.isDeclaringDone,
        hasFulfilledContract: !!analysis.hasFulfilledContract,
        missingRequirements: Array.isArray(analysis.missingRequirements) ? analysis.missingRequirements : [],
        isTalkingWithoutAction: !!analysis.isTalkingWithoutAction
      };

    } catch (error) {
      console.warn("⚠️ Falha ao analisar turno do desenvolvedor via LLM, ativando fallback de segurança:", error.message);
      
      // FALLBACK (O velho e bom if/else salva a pátria se a IA falhar)
      const isDeclaringDone = /(concluíd[oa]|pronto|finalizad[oa]|terminei|resolvido|feito|entregue)/i.test(rawOutput);
      const isTalkingWithoutAction = !rawOutput.includes('"tool":') && rawOutput.trim().length > 50;
      
      let missingReqs = [];
      if (isDeclaringDone && !doneExists) {
        missingReqs.push("Falta criar o arquivo .done usando a ferramenta 'exec' (touch .done).");
      }

      return {
        isDeclaringDone,
        hasFulfilledContract: isDeclaringDone && doneExists,
        missingRequirements: missingReqs,
        isTalkingWithoutAction
      };
    }
  }
}

module.exports = TaskAnalysisService;


