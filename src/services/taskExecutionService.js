// src/services/taskExecutionService.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Importação dos serviços
const agentService = require('./agentService');
const WorkspaceSnapshotService = require('./workspaceSnapshotService');
const OpenClawService = require('./openclawService');
const ContractVerificationService = require('./contractVerificationService');
const EvidenceService = require('./evidenceService');
const TaskAnalysisService = require('./taskAnalysisService');
const PromptFactory = require('../utils/promptFactory');

// Utilitários
const { fileExists } = require('../utils/fileUtils');
const { runPipeline } = require('../utils/pipelineUtils'); // <-- Nosso novo motor
const { log } = require('../../aux/logger');

const prisma = new PrismaClient();

class TaskExecutionService {
  
  // ==========================================
  // MÉTODOS AUXILIARES DE LOG
  // ==========================================
  static async createExecutionLog(task, userId, agentId) {
    let model = 'deepseek/deepseek-chat';
    if (agentId) {
      try {
        const agentDetails = await agentService.getAgentDetails(agentId);
        model = agentDetails.identity?.model || model;
      } catch (error) { /* Silencioso */ }
    }
    return await prisma.taskExecutionLog.create({
      data: { taskId: task.id, userId, model, startedAt: new Date(), success: false }
    });
  }

  static async finishExecutionLog(logId, result) {
    const logEntry = await prisma.taskExecutionLog.findUnique({ where: { id: logId } });
    if (!logEntry) return;
    return await prisma.taskExecutionLog.update({
      where: { id: logId },
      data: {
        finishedAt: new Date(),
        durationMs: new Date() - logEntry.startedAt,
        success: result.success || false,
        exitCode: result.exitCode,
        errorMessage: result.errorMessage,
        executionNotes: result.executionNotes
      }
    });
  }

  // ==========================================
  // ETAPAS DO PIPELINE (STEPS)
  // ==========================================

  /**
   * Passo 1: Prepara arquivos, banco de dados e analisa o escopo.
   */
  static async stepSetupContext(ctx) {
    const { task, userId, config } = ctx;
    const { TASKS_DIR } = config;

    const project = task.projectId ? await prisma.project.findUnique({ where: { id: task.projectId } }) : null;
    const analysisPlan = await TaskAnalysisService.analyzeTaskScope(task, project);
    
    // Prepara os caminhos dos arquivos
    const taskId = task.id;
    const files = {
      promptFile: path.join(TASKS_DIR, `prompt-${taskId}.txt`),
      relatorioFile: path.join(TASKS_DIR, `relatorio-${taskId}.txt`),
      doneFile: path.join(TASKS_DIR, `done-${taskId}.done`),
      terminalLogFile: path.join(TASKS_DIR, `terminal-${taskId}.log`),
      architectPlanFile: path.join(TASKS_DIR, `plano-arquiteto-${taskId}.txt`),
      architectLogFile: path.join(TASKS_DIR, `terminal-arquiteto-${taskId}.log`)
    };

    // Cria as regras de ouro
    const dirBase = project?.pastaBase || 'Diretório atual';
    const engineRules = PromptFactory.buildEngineRulesPrompt(files);

    // Adiciona comentários ao prompt se existirem
    let commentsSection = '';
    if (task.comments && task.comments.length > 0) {
      commentsSection = '\n\n=== COMENTÁRIOS DA TAREFA ===\n';
      task.comments.forEach((comment, index) => {
        const userInfo = comment.user ? `${comment.user.name} (${comment.user.nickname})` : 'Usuário';
        const timestamp = new Date(comment.createdAt).toLocaleString('pt-BR');
        commentsSection += `\n${index + 1}. [${timestamp}] ${userInfo}: ${comment.content}`;
      });
    }

    const promptContent = `Agente Jarbas. TAREFA: ${task.title}. DESC: ${task.description}. BASE: ${dirBase}.${commentsSection}\n\n${engineRules}`;
    
    await fs.writeFile(files.promptFile, promptContent);
    await fs.writeFile(files.relatorioFile, '');
    await fs.writeFile(files.terminalLogFile, '');

    const initialSnapshot = await WorkspaceSnapshotService.takeSnapshot(project?.pastaBase || TASKS_DIR);
    const executionLog = await TaskExecutionService.createExecutionLog(task, userId, task.agent);

    return { ...ctx, project, analysisPlan, files, initialSnapshot, executionLog, currentInput: promptContent };
  }

  /**
   * Passo 2: Se for desenvolvimento, o Arquiteto planeja a execução.
   */
  static async stepArchitectPlanning(ctx) {
    if (ctx.analysisPlan.taskType !== 'development') {
      await log(`⏭️ [Arquiteto] Pulado: Tarefa não é de desenvolvimento.`);
      return ctx; 
    }

    const { task, project, files, initialSnapshot, config } = ctx;
    const fileList = Array.from(initialSnapshot.keys());
    
    const architectInput = PromptFactory.buildArchitectPrompt(task, project, fileList, files.architectPlanFile);
    await log(`🧠 [Arquiteto] Avaliando a tarefa ${task.id} e montando o plano de ação...`);

    // Roda o Arquiteto com timeout de 10 minutos (600000ms)
    const architectResult = await OpenClawService.execute(
      `${task.id}-architect`, 
      architectInput, 
      project.agent || 'analista-pleno',            
      null,                   
      config.TASKS_DIR, 
      files.architectLogFile, 
      project?.pastaBase, 
      600000                  
    );

    // Remove .done se o arquiteto criou indevidamente
    await fs.unlink(files.doneFile).catch(() => {});
    
    let architectPlan = "";
    let architectAnalysis = null;
    
    // Usar a saída direta do OpenClaw em vez de ler arquivo
    if (architectResult.rawOutput && architectResult.rawOutput.trim().length > 0) {
      architectPlan = architectResult.rawOutput;
      await log(`📝 [Arquiteto] Resposta recebida (${architectPlan.length} caracteres): ${architectPlan.substring(0, 200)}...`);
      
      // 1. ANÁLISE INTELIGENTE DA RESPOSTA DO ARQUITETO
      // Usa LLM para compreender semanticamente se o arquiteto já executou ou só planejou
      await log(`🧠 [Arquiteto] Analisando resposta com IA...`);
      architectAnalysis = await TaskAnalysisService.analyzeArchitectResponse(architectPlan, task, project);
      
      await log(`📊 [Arquiteto] Análise: hasExecuted=${architectAnalysis.hasExecuted}, hasPlan=${architectAnalysis.hasPlan}, confidence=${architectAnalysis.confidence}%`);
      
      if (architectAnalysis.hasExecuted) {
        await log(`✅ [Arquiteto] Análise indica que já executou a tarefa (${architectAnalysis.confidence}% confiança).`);
        if (architectAnalysis.executionDetails) {
          await log(`📝 [Arquiteto] Detalhes: ${architectAnalysis.executionDetails.substring(0, 100)}...`);
        }
      } else if (architectAnalysis.hasPlan) {
        await log(`📋 [Arquiteto] Análise indica que gerou plano de ação (${architectAnalysis.confidence}% confiança).`);
        if (architectAnalysis.planDetails) {
          await log(`📝 [Arquiteto] Detalhes: ${architectAnalysis.planDetails.substring(0, 100)}...`);
        }
      } else if (architectAnalysis.analysisFailed) {
        await log(`⚠️ [Arquiteto] Análise falhou ou resposta incompreensível.`);
      } else {
        await log(`ℹ️ [Arquiteto] Análise não identificou execução nem plano claro.`);
      }
      
      // Opcional: Salvar plano em arquivo para referência (mas não dependemos mais dele)
      try {
        await fs.writeFile(files.architectPlanFile, architectPlan);
        await log(`💾 [Arquiteto] Plano salvo em arquivo para referência: ${files.architectPlanFile}`);
      } catch (error) {
        await log(`⚠️ [Arquiteto] Não foi possível salvar plano em arquivo: ${error.message}`);
      }
    } else {
      architectPlan = "O arquiteto não conseguiu gerar um plano detalhado. Siga a descrição original da tarefa.";
      architectAnalysis = {
        hasExecuted: false,
        hasPlan: false,
        confidence: 0,
        executionDetails: null,
        planDetails: null,
        analysisFailed: true
      };
      await log(`⚠️ [Arquiteto] Resposta vazia ou inválida. Usando descrição original.`);
    }

    // 2. DECIDIR FLUXO COM BASE NA ANÁLISE INTELIGENTE
    let updatedPromptContent;
    
    if (architectAnalysis.hasExecuted && architectAnalysis.confidence > 70 && architectPlan.trim()) {
      // Arquiteto já executou com alta confiança - usar APENAS a análise do arquiteto
      updatedPromptContent = `=== EXECUÇÃO CONCLUÍDA PELO ARQUITETO ===\n${architectPlan}\n\nVerifique se as alterações descritas acima foram realmente implementadas.`;
      await log(`🔄 [Arquiteto] Fluxo: Usando execução do arquiteto (alta confiança).`);
    } else if (architectAnalysis.hasPlan && architectPlan.trim()) {
      // Arquiteto gerou plano - concatenar de forma otimizada
      updatedPromptContent = `${ctx.currentInput}\n\n=== PLANO DE AÇÃO DO ARQUITETO ===\nSiga estritamente estes passos técnicos para concluir a tarefa:\n${architectPlan}`;
      await log(`🔄 [Arquiteto] Fluxo: Concatenando plano ao prompt original.`);
    } else if (architectAnalysis.analysisFailed || !architectPlan.trim()) {
      // Arquiteto falhou - manter original
      updatedPromptContent = ctx.currentInput;
      await log(`🔄 [Arquiteto] Fluxo: Mantendo prompt original (análise falhou).`);
    } else {
      // Caso padrão (baixa confiança, resposta ambígua)
      updatedPromptContent = `${ctx.currentInput}\n\n=== ANÁLISE DO ARQUITETO ===\n${architectPlan}\n\nAnalise a resposta acima e execute conforme necessário.`;
      await log(`🔄 [Arquiteto] Fluxo: Resposta ambígua, incluindo análise como referência.`);
    }
    
    await fs.writeFile(files.promptFile, updatedPromptContent);

    return { 
      ...ctx, 
      currentInput: updatedPromptContent,
      architectAnalysis, // Análise inteligente para stepDeveloperLoop
      architectPlan
    };
  }

  /**
   * Verifica se o arquiteto já executou a tarefa e se está tudo correto
   * @returns {Object|null} Retorna finalResult se arquiteto concluiu, ou null se precisa do desenvolvedor
   */
  static async verifyArchitectWork(ctx) {
    const { task, project, analysisPlan, files, initialSnapshot, architectAnalysis, architectPlan } = ctx;
    
    if (!architectAnalysis || !architectAnalysis.hasExecuted || architectAnalysis.confidence <= 70) {
      return null; // Arquiteto não executou ou baixa confiança
    }
    
    await log(`🔍 [Verificação] Arquiteto indica execução (${architectAnalysis.confidence}% confiança).`);
    
    // Verificar evidências do arquiteto
    const architectDoneExists = await fileExists(files.doneFile);
    const architectReportExists = await fileExists(files.relatorioFile);
    const currentSnapshot = await WorkspaceSnapshotService.takeSnapshot(project?.pastaBase || ctx.config.TASKS_DIR);
    const changes = WorkspaceSnapshotService.compareSnapshots(initialSnapshot, currentSnapshot);
    const hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
    const architectLeftEvidence = architectDoneExists || architectReportExists || hasRealChanges;
    
    if (!architectLeftEvidence) {
      await log(`⚠️ [Verificação] Arquiteto não deixou evidências de execução.`);
      return { needsDeveloper: true, message: `O arquiteto analisou a tarefa, mas não encontramos evidências de execução.\n\n${architectPlan || 'Siga a descrição original da tarefa.'}` };
    }
    
    if (!hasRealChanges) {
      await log(`📝 [Verificação] Arquiteto deixou .done/relatório, mas não alterou arquivos.`);
      return { needsDeveloper: true, message: `O arquiteto analisou e disse que já fez a tarefa, mas não encontramos alterações nos arquivos.\n\n${architectPlan}\n\nPor favor, execute a tarefa conforme descrito acima.` };
    }
    
    await log(`📁 [Verificação] Arquiteto alterou ${changes.modified.length} arquivos, criou ${changes.created.length}.`);
    
    // Verificar contrato
    const contractResult = await ContractVerificationService.verifyContract(
      files.doneFile, 
      files.relatorioFile, 
      files.terminalLogFile, { 
        taskType: analysisPlan.taskType, 
        evidence: EvidenceService.createEmptyEvidence(),
        task, 
        project, 
        analysisPlan, 
        initialSnapshot
      }
    );
    
    if (!contractResult.contractFulfilled) {
      await log(`⚠️ [Verificação] Contrato não cumprido pelo arquiteto: ${contractResult.executionNotes}`);
      return { needsDeveloper: true, message: contractResult.feedbackToAgent || `O arquiteto fez alterações, mas não cumpriu o contrato: ${contractResult.executionNotes}\n\nPor favor, corrija.` };
    }
    
    await log(`✅ [Verificação] Contrato cumprido pelo arquiteto. Verificando build...`);
    
    // QA/Build validation
    let qa = { passed: true };
    if (project) {
      const BUILD_TIMEOUT = 60000;
      if (project.backendBuildCmd && project.backendPath) {
        try {
          await log(`⏳ Testando build Backend...`);
          execSync(project.backendBuildCmd, { cwd: path.join(project.pastaBase, project.backendPath), stdio: 'pipe', timeout: BUILD_TIMEOUT });
        } catch (e) { qa = { passed: false, message: `Build Backend falhou: ${e.message}` }; }
      }
      if (qa.passed && project.frontendBuildCmd && project.frontendPath) {
        try {
          await log(`⏳ Testando build Frontend...`);
          execSync(project.frontendBuildCmd, { cwd: path.join(project.pastaBase, project.frontendPath), stdio: 'pipe', timeout: BUILD_TIMEOUT });
        } catch (e) { qa = { passed: false, message: `Build Frontend falhou: ${e.message}` }; }
      }
    }
    
    if (!qa.passed) {
      await log(`❌ QA Reprovado. Build falhou: ${qa.message}`);
      await fs.unlink(files.doneFile).catch(()=>{});
      return { needsDeveloper: true, message: `Build falhou: ${qa.message}. O arquiteto fez alterações, mas o build não passa. Corrija o código e finalize novamente com .done.` };
    }
    
    await log(`✅ [Verificação] Tudo verificado! Arquiteto concluiu tarefa com sucesso.`);
    
    return {
      success: true,
      contractResult: {
        contractFulfilled: true,
        executionNotes: `Tarefa executada pelo arquiteto. Alterações: ${changes.modified.length} modificados, ${changes.created.length} criados. Build verificado.`
      },
      finalResult: { 
        success: true, 
        executionNotes: `Tarefa executada pelo arquiteto. Alterações: ${changes.modified.length} modificados, ${changes.created.length} criados. Build verificado.` 
      }
    };
  }

  /**
   * Passo 3: O loop principal de execução do Jarbas (Desenvolvedor).
   */
  static async stepDeveloperLoop(ctx) {
    let { task, project, analysisPlan, files, initialSnapshot, currentInput, config, architectAnalysis, architectPlan } = ctx;
    const { TASKS_DIR, TASK_TIMEOUT_MS } = config;
    
    const evidence = EvidenceService.createEmptyEvidence();
    
    // 1. VERIFICAR SE O ARQUITETO JÁ FEZ A TAREFA
    const architectVerification = await TaskExecutionService.verifyArchitectWork(ctx);
    
    if (architectVerification) {
      if (architectVerification.success) {
        // Arquiteto concluiu com sucesso
        return { 
          ...ctx, 
          contractResult: architectVerification.contractResult,
          finalResult: architectVerification.finalResult
        };
      } else if (architectVerification.needsDeveloper) {
        // Arquiteto falhou em algum aspecto - desenvolvedor precisa intervir
        currentInput = architectVerification.message;
        await fs.writeFile(files.promptFile, currentInput);
        await log(`🔄 [Desenvolvedor] Necessita intervenção: ${architectVerification.message.substring(0, 100)}...`);
      }
    }
    let contractResult = { contractFulfilled: false };
    let turnos = 0; 
    let turnosSemProgresso = 0;

    // Se chegou aqui, precisa do desenvolvedor
    await log(`🔄 [Desenvolvedor] Iniciando loop de execução...`);

    while (!contractResult.contractFulfilled && turnos < 10 && turnosSemProgresso < 3) {
      await log(`🤖 Turno ${turnos + 1}...`);
      turnos++;
      
      const res = await OpenClawService.execute(
        task.id, currentInput, task.agent || 'main', null, TASKS_DIR, files.terminalLogFile, project?.pastaBase, TASK_TIMEOUT_MS
      );
      
      EvidenceService.applyExecutionEvidence(
        evidence, res.toolCall, res.toolResult || {}, { executionDirectory: project?.pastaBase || TASKS_DIR }
      );
      
      contractResult = await ContractVerificationService.verifyContract(files.doneFile, files.relatorioFile, files.terminalLogFile, { 
        taskType: analysisPlan.taskType, 
        evidence, task, project, analysisPlan, initialSnapshot
      });
      
      if (contractResult.contractFulfilled) {
        // Build Validation embutida no loop para o agente poder consertar se quebrar
        let qa = { passed: true };
        if (project) {
          const BUILD_TIMEOUT = 60000;
          if (project.backendBuildCmd && project.backendPath) {
            try {
              await log(`⏳ Testando build Backend...`);
              execSync(project.backendBuildCmd, { cwd: path.join(project.pastaBase, project.backendPath), stdio: 'pipe', timeout: BUILD_TIMEOUT });
            } catch (e) { qa = { passed: false, message: `Build Backend falhou: ${e.message}` }; }
          }
          if (qa.passed && project.frontendBuildCmd && project.frontendPath) {
            try {
              await log(`⏳ Testando build Frontend...`);
              execSync(project.frontendBuildCmd, { cwd: path.join(project.pastaBase, project.frontendPath), stdio: 'pipe', timeout: BUILD_TIMEOUT });
            } catch (e) { qa = { passed: false, message: `Build Frontend falhou: ${e.message}` }; }
          }
        }

        if (!qa.passed) {
          await fs.unlink(files.doneFile).catch(()=>{});
          currentInput = `Build falhou: ${qa.message}. Corrija o erro no código e finalize novamente com .done.`;
          await log(`❌ QA Reprovado. Retornando erro para o agente: ${qa.message}`);
          contractResult.contractFulfilled = false;
          continue;
        }
        break; // Passou no contrato e no QA
      }

      // Trata feedback de falha de contrato
      const doneExists = await fs.access(files.doneFile).then(() => true).catch(() => false);
      if (doneExists && contractResult.feedbackToAgent) {
          await fs.unlink(files.doneFile).catch(()=>{});
          currentInput = contractResult.feedbackToAgent;
          await fs.writeFile(files.promptFile, currentInput); // CRÍTICO: Atualiza arquivo de prompt
          await log(`📝 [Desenvolvedor] Feedback enviado: ${currentInput.substring(0, 100)}...`);
      } else {
          currentInput = res.toolFeedback || res.rawOutput || 'Continue.';
      }
      
      const prog = EvidenceService.computeTurnProgress(res.toolResult || {}, contractResult, project?.pastaBase || TASKS_DIR);
      prog.hasMeaningfulProgress ? (turnosSemProgresso = 0) : turnosSemProgresso++;
      
      if (turnosSemProgresso >= 6) { 
        contractResult.executionNotes = 'Estagnação de IA detectada (6 turnos sem progresso real).'; 
        break; 
      }
    }

    // Garantir que contractResult está definido
    if (!contractResult || contractResult.contractFulfilled === undefined) {
      contractResult = { 
        contractFulfilled: false, 
        executionNotes: 'Loop finalizado sem verificação de contrato' 
      };
      await log(`⚠️ [Desenvolvedor] contractResult indefinido, definindo como falha`);
    }
    
    await log(`📊 [Desenvolvedor] Loop finalizado. contractResult: ${JSON.stringify(contractResult)}`);
    return { ...ctx, contractResult };
  }

  /**
   * Passo 4: Finaliza o log no banco e consolida o resultado.
   */
  static async stepTeardown(ctx) {
    const { executionLog } = ctx;
    let { contractResult } = ctx; // Mudar para let para permitir reatribuição
    
    // Validação de segurança
    if (!contractResult) {
      console.error('❌ stepTeardown: contractResult é undefined!', { ctxKeys: Object.keys(ctx) });
      contractResult = { contractFulfilled: false, executionNotes: 'Erro: contractResult não definido' };
    }
    
    const finalResult = { 
      success: contractResult.contractFulfilled, 
      executionNotes: contractResult.executionNotes || (contractResult.contractFulfilled ? 'Sucesso' : 'Falha na execução')
    };

    if (executionLog) {
      await TaskExecutionService.finishExecutionLog(executionLog.id, finalResult);
    }

    return { ...ctx, finalResult };
  }

  // ==========================================
  // O ORQUESTRADOR PRINCIPAL
  // ==========================================

  static async executeTask(task, userId, config) {
    const initialContext = { task, userId, config };

    // Definição limpa da esteira de produção
    const steps = [
      this.stepSetupContext,
      this.stepArchitectPlanning,
      this.stepDeveloperLoop,
      this.stepTeardown
    ];

    try {
      // O motor do pipeline assume o controle
      const finalState = await runPipeline(`Task-${task.id}`, initialContext, steps);
      
      return { 
        success: finalState.finalResult.success, 
        executionNotes: finalState.finalResult.executionNotes, 
        taskId: task.id 
      };

    } catch (error) {
      // Tratamento de segurança caso alguma etapa estoure um erro não tratado
      await log(`💥 [FATAL] O pipeline falhou: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TaskExecutionService;


