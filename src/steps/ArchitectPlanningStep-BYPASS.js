// src/steps/ArchitectPlanningStep-BYPASS.js
/**
 * VERSÃO MODIFICADA: Bypassa a chamada real do arquiteto e retorna plano válido
 * Use para testes quando não quiser chamar o OpenClaw/arquiteto real
 */

const container = require('../container');

class ArchitectPlanningStepBYPASS {
  /**
   * Construtor que obtém dependências do container.
   */
  constructor(options = {}) {
    this.log = container.resolve('log');
    
    // Usar instâncias fornecidas ou criar do container
    this.openClawService = options.openClawService || container.resolve('openClawService');
    this.sessionChainUtils = options.sessionChainUtils || container.resolve('sessionChainUtils');
    this.smartFileFinder = options.smartFileFinder || container.resolve('smartFileFinder');
    this.taskAnalysisService = options.taskAnalysisService || container.resolve('taskAnalysisService');
    this.workspaceSnapshotService = options.workspaceSnapshotService || container.resolve('workspaceSnapshotService');
    this.fileUtils = options.fileUtils || container.resolve('fileUtils');
    this.fileSystem = options.fileSystem || container.resolve('fileSystem');
    this.promptFactory = options.promptFactory || container.resolve('promptFactory');
  }

  /**
   * Executa o step de planejamento do arquiteto COM BYPASS
   * NÃO chama o OpenClaw real - retorna plano pré-definido
   */
  async execute(context) {
    const { 
      task, 
      project, 
      files, 
      initialSnapshot, 
      config, 
      analysisPlan, 
      commentsSection = '', 
      developerPrompt = '',
      currentInput = ''
    } = context;
    
    if (!task || !files || !config) {
      await this.log(`⚠️ ArchitectPlanningStepBYPASS: contexto incompleto`);
      return {
        ...context,
        architectPlanningResult: {
          success: false,
          error: 'contexto incompleto (task, files ou config faltando)'
        }
      };
    }

    try {
      await this.log(`📋 [Arquiteto-BYPASS] Tipo de tarefa: ${analysisPlan.taskType}`);
      await this.log(`🧠 [Arquiteto-BYPASS] BYPASS ATIVADO: Ignorando chamada real do arquiteto`);
      
      // ✅ BYPASS: Não gera sessão, não chama OpenClaw
      // Em vez disso, cria um plano de arquiteto válido diretamente
      
      const architectPlan = this.generateBypassArchitectPlan(task, project, analysisPlan);
      
      await this.log(`📝 [Arquiteto-BYPASS] Plano gerado via bypass (${architectPlan.length} caracteres).`);
      
      // ✅ BYPASS: Grava o plano no arquivo (simula o que o arquiteto faria)
      await this.fileSystem.writeFile(files.architectPlanFile, architectPlan);
      await this.log(`💾 [Arquiteto-BYPASS] Plano salvo em: ${files.architectPlanFile}`);
      
      // ✅ BYPASS: Cria um log de arquiteto vazio (para consistência)
      await this.fileSystem.writeFile(files.architectLogFile, '[BYPASS] Chamada do arquiteto ignorada para testes\n');
      
      // =====================================================================
      // PASSO 2: Analisar o plano (mantém a lógica real de análise)
      // =====================================================================
      await this.log(`🧠 [Arquiteto-BYPASS] Analisando resposta com IA...`);
      const existsDoneFile = await this.fileUtils.fileExists(files.doneFile);
      
      // 🕵️ DETETIVE DE ARQUIVOS: Verifica se houve "mão na massa"
      const currentSnapshot = await this.workspaceSnapshotService.takeSnapshot(project?.pastaBase || config.TASKS_DIR);
      const changes = this.workspaceSnapshotService.compareSnapshots(initialSnapshot, currentSnapshot);
      const hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
      
      if (hasRealChanges) {
        await this.log(`👀 [Arquiteto-BYPASS] DETECTADO: Alterações reais no workspace`);
      }

      // Analisa o plano gerado (mantém a lógica real)
      const architectAnalysis = await this.taskAnalysisService.analyzeArchitectResponse(
        architectPlan, 
        task, 
        project,
        { hasRealChanges, existsDoneFile, changes }
      );
      
      await this.log(`📊 [Arquiteto-BYPASS] Análise: hasExecuted=${architectAnalysis.hasExecuted}, hasPlan=${architectAnalysis.hasPlan}, confidence=${architectAnalysis.confidence}%`);
      
      // =====================================================================
      // 3. DECIDIR FLUXO COM BASE NA ANÁLISE INTELIGENTE
      // =====================================================================
      let updatedPromptContent;
      
      if (architectAnalysis.hasExecuted && architectAnalysis.confidence > 70 && architectPlan.trim()) {
        updatedPromptContent = `=== EXECUÇÃO CONCLUÍDA PELO ARQUITETO ===\n${architectPlan}\n\nVerifique se as alterações descritas acima foram realmente implementadas.`;
        await this.log(`🔄 [Arquiteto-BYPASS] Fluxo: Usando execução do arquiteto.`);
      } else if (architectAnalysis.hasPlan && architectPlan.trim()) {
        updatedPromptContent = `=== PLANO DE AÇÃO DO ARQUITETO ===\n${architectPlan}\n\n${developerPrompt}`;
        await this.log(`🔄 [Arquiteto-BYPASS] Fluxo: Substituindo prompt pelo plano + instruções do desenvolvedor.`);
      } else if (architectAnalysis.analysisFailed || !architectPlan.trim()) {
        updatedPromptContent = developerPrompt;
        await this.log(`🔄 [Arquiteto-BYPASS] Fluxo: Mantendo APENAS instruções do desenvolvedor (análise falhou).`);
      } else {
        updatedPromptContent = `=== ANÁLISE DO ARQUITETO ===\n${architectPlan}\n\n${developerPrompt}\n\nAnalise a resposta acima e execute a tarefa.`;
        await this.log(`🔄 [Arquiteto-BYPASS] Fluxo: Resposta ambígua, incluindo análise como referência.`);
      }
      
      // Grava o prompt atualizado
      await this.fileSystem.writeFile(files.promptFile, updatedPromptContent);
      await this.log(`💾 [Arquiteto-BYPASS] Prompt atualizado salvo em: ${files.promptFile}`);
      
      await this.log(`✅ [Arquiteto-BYPASS] Planejamento concluído para tarefa ${task.id} (BYPASS)`);
      
      return {
        ...context,
        architectPlanningResult: {
          success: true,
          taskId: task.id,
          hasArchitectPlan: !!architectPlan.trim(),
          hasArchitectExecution: architectAnalysis.hasExecuted,
          confidence: architectAnalysis.confidence,
          promptUpdated: true,
          bypassUsed: true  // Flag indicando que usou bypass
        },
        currentInput: updatedPromptContent,
        architectAnalysis,
        architectPlan
      };
      
    } catch (stepError) {
      await this.log(`💥 Erro no ArchitectPlanningStepBYPASS para tarefa ${task.id}: ${stepError.message}`);
      
      return {
        ...context,
        architectPlanningResult: {
          success: false,
          error: stepError.message,
          taskId: task.id,
          bypassUsed: true
        },
        shouldAbort: true,
        abortReason: `Falha no planejamento do arquiteto (BYPASS): ${stepError.message}`
      };
    }
  }

  /**
   * Gera um plano de arquiteto válido para bypass
   */
  generateBypassArchitectPlan(task, project, analysisPlan) {
    const taskTitle = task.title || 'Tarefa sem título';
    const taskDesc = task.description || 'Sem descrição';
    
    let plan = `PLANO TÉCNICO DO ARQUITETO (BYPASS MODE)
Tarefa: ${taskTitle}
Descrição: ${taskDesc}
Tipo: ${analysisPlan.taskType}
Data: ${new Date().toISOString()}

=== ANÁLISE INICIAL ===
O arquiteto analisou a tarefa e identificou os seguintes requisitos:
1. ${taskDesc}
2. Tipo de desenvolvimento: ${analysisPlan.taskType}
3. Camadas esperadas: ${analysisPlan.expectedLayers?.join(', ') || 'N/A'}

=== CHECKLIST OBRIGATÓRIO ===
`;

    // Adiciona checks obrigatórios do analysisPlan
    if (analysisPlan.mandatoryChecks && analysisPlan.mandatoryChecks.length > 0) {
      analysisPlan.mandatoryChecks.forEach((check, index) => {
        plan += `${index + 1}. ${check}\n`;
      });
    }

    plan += `
=== PLANO DE AÇÃO DETALHADO ===
`;

    // Gera plano baseado no tipo de tarefa
    if (analysisPlan.taskType === 'development') {
      if (analysisPlan.expectedLayers?.includes('frontend')) {
        plan += this.generateFrontendPlan(task, project);
      } else if (analysisPlan.expectedLayers?.includes('backend')) {
        plan += this.generateBackendPlan(task, project);
      } else {
        plan += this.generateGenericPlan(task, project);
      }
    } else if (analysisPlan.taskType === 'analysis') {
      plan += this.generateAnalysisPlan(task, project);
    } else {
      plan += this.generateGenericPlan(task, project);
    }

    plan += `
=== RISCOS IDENTIFICADOS ===
`;

    if (analysisPlan.risks && analysisPlan.risks.length > 0) {
      analysisPlan.risks.forEach((risk, index) => {
        plan += `${index + 1}. ${risk}\n`;
      });
    } else {
      plan += `1. Nenhum risco crítico identificado\n`;
    }

    plan += `
=== DEFINIÇÃO DE PRONTO ===
`;

    if (analysisPlan.definitionOfDone && analysisPlan.definitionOfDone.length > 0) {
      analysisPlan.definitionOfDone.forEach((item, index) => {
        plan += `✅ ${item}\n`;
      });
    } else {
      plan += `✅ Tarefa implementada conforme especificado\n`;
      plan += `✅ Código testado e funcional\n`;
      plan += `✅ Documentação atualizada\n`;
    }

    plan += `
=== NOTA DO BYPASS ===
Este plano foi gerado automaticamente para testes, sem chamar o arquiteto real.
Em produção, o arquiteto IA seria consultado para gerar um plano personalizado.
`;

    return plan;
  }

  generateFrontendPlan(task, project) {
    return `1. ANÁLISE DA ARQUITETURA FRONTEND:
   - Projeto: ${project?.name || 'N/A'}
   - Caminho: ${project?.frontendPath || 'N/A'}
   - Porta: ${project?.frontendPort || 3000}

2. COMPONENTES NECESSÁRIOS:
   - Criar/atualizar componentes React com TypeScript
   - Implementar lógica de estado com useState/useReducer
   - Gerenciar side-effects com useEffect

3. ROTEAMENTO E NAVEGAÇÃO:
   - Definir rotas necessárias
   - Implementar navegação entre views
   - Gerenciar parâmetros de URL

4. ESTILIZAÇÃO:
   - Usar sistema de design existente
   - Manter consistência visual
   - Implementar responsividade

5. INTEGRAÇÃO COM BACKEND:
   - Chamadas API para ${project?.backendPath || 'backend'}
   - Gerenciamento de estado global (context/Redux)
   - Tratamento de erros e loading states

6. TESTES:
   - Testes unitários para componentes
   - Testes de integração para fluxos
   - Testes E2E para cenários críticos
`;
  }

  generateBackendPlan(task, project) {
    return `1. ANÁLISE DA ARQUITETURA BACKEND:
   - Projeto: ${project?.name || 'N/A'}
   - Caminho: ${project?.backendPath || 'N/A'}
   - Porta: ${project?.backendPort || 4001}

2. ENDPOINTS NECESSÁRIOS:
   - Definir rotas RESTful
   - Implementar controllers
   - Configurar middlewares

3. BANCO DE DADOS:
   - Definir schema Prisma
   - Criar migrações
   - Implementar queries

4. VALIDAÇÃO E SEGURANÇA:
   - Validar dados de entrada
   - Implementar autenticação/autorização
   - Configurar CORS e rate limiting

5. LOGS E MONITORAMENTO:
   - Configurar logging estruturado
   - Implementar métricas
   - Configurar alertas

6. TESTES:
   - Testes unitários para services
   - Testes de integração para APIs
   - Testes de carga para endpoints críticos
`;
  }

  generateAnalysisPlan(task, project) {
    return `1. COLETA DE DADOS:
   - Identificar fontes de informação
   - Extrair dados relevantes
   - Normalizar formatos

2. ANÁLISE TÉCNICA:
   - Avaliar requisitos funcionais
   - Identificar dependências técnicas
   - Mapear riscos e complexidades

3. DOCUMENTAÇÃO:
   - Criar especificação técnica
   - Documentar decisões de arquitetura
   - Elaborar plano de implementação

4. RECOMENDAÇÕES:
   - Sugerir abordagens técnicas
   - Estimar esforço e timeline
   - Identificar pré-requisitos
`;
  }

  generateGenericPlan(task, project) {
    return `1. ANÁLISE DE REQUISITOS:
   - Revisar descrição da tarefa: "${task.description?.substring(0, 100)}..."
   - Identificar stakeholders e usuários finais
   - Definir critérios de aceitação

2. DESIGN DA SOLUÇÃO:
   - Propor arquitetura técnica
   - Definir componentes/modulos
   - Especificar interfaces e APIs

3. PLANO DE IMPLEMENTAÇÃO:
   - Dividir em subtarefas menores
   - Estimar tempo e recursos
   - Definir ordem de execução

4. TESTES E QUALIDADE:
   - Definir estratégia de testes
   - Especificar critérios de qualidade
   - Planejar revisões de código

5. DEPLOY E MANUTENÇÃO:
   - Definir processo de deploy
   - Planejar monitoramento
   - Estabelecer suporte pós-implantação
`;
  }

  /**
   * Método estático de conveniência para uso direto
   */
  static async planArchitectBypass(context) {
    const step = new ArchitectPlanningStepBYPASS();
    const result = await step.execute(context);
    return result.architectPlanningResult;
  }
}

module.exports = ArchitectPlanningStepBYPASS;