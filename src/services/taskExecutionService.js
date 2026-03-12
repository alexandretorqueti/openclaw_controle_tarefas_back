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

    const promptContent = `Agente Jarbas. TAREFA: ${task.title}. DESC: ${task.description}. BASE: ${dirBase}. ${engineRules}`;
    
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
    await OpenClawService.execute(
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

    let architectPlan = "O arquiteto não conseguiu gerar um plano detalhado. Siga a descrição original da tarefa.";
    if (await fileExists(files.architectPlanFile)) {
       architectPlan = await fs.readFile(files.architectPlanFile, 'utf8');
    }

    // Anexa o plano ao prompt do Desenvolvedor
    const updatedPromptContent = `${ctx.currentInput}\n\n=== PLANO DE AÇÃO DO ARQUITETO ===\nSiga estritamente estes passos técnicos para concluir a tarefa:\n${architectPlan}`;
    await fs.writeFile(files.promptFile, updatedPromptContent);

    return { ...ctx, currentInput: updatedPromptContent };
  }

  /**
   * Passo 3: O loop principal de execução do Jarbas (Desenvolvedor).
   */
  static async stepDeveloperLoop(ctx) {
    let { task, project, analysisPlan, files, initialSnapshot, currentInput, config } = ctx;
    const { TASKS_DIR, TASK_TIMEOUT_MS } = config;
    
    const evidence = EvidenceService.createEmptyEvidence();
    let contractResult = { contractFulfilled: false };
    let turnos = 0; 
    let turnosSemProgresso = 0;

    while (!contractResult.contractFulfilled && turnos < 100) {
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

    return { ...ctx, contractResult };
  }

  /**
   * Passo 4: Finaliza o log no banco e consolida o resultado.
   */
  static async stepTeardown(ctx) {
    const { executionLog, contractResult } = ctx;
    
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


