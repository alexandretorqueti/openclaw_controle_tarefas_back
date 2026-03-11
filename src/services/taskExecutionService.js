// src/services/taskExecutionService.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process'); // spawn removido daqui
const agentService = require('./agentService');
const WorkspaceSnapshotService = require('./workspaceSnapshotService');
const OpenClawService = require('./openclawService'); // <-- Novo serviço importado

// Importação dos serviços modularizados
const ContractVerificationService = require('./contractVerificationService');
const EvidenceService = require('./evidenceService');
const TaskAnalysisService = require('./taskAnalysisService');
const ToolCallService = require('./toolCallService');
const PromptFactory = require('../utils/promptFactory');

// Importação de utilitários
const { resolveProjectPath, isPathInside, normalizeFsPath, extractPathTokensFromCommand } = require('../utils/pathUtils');
const { formatNumberedList, formatInlineList, printDebugBlock } = require('../utils/formatUtils');
const { normalizeCommandSignature, isInspectionCommand, isMutationCommand, commandTargetsOnlySpecialFiles, isMeaningfulCommand } = require('../utils/commandUtils');
const { extractJsonObjects, inspectJsonLikeStructure } = require('../utils/jsonUtils');
const { fileExists } = require('../utils/fileUtils');

const prisma = new PrismaClient();

class TaskExecutionService {
  static async createExecutionLog(task, userId, agentId) {
    try {
      let model = 'deepseek/deepseek-chat';
      if (agentId) {
        try {
          const agentDetails = await agentService.getAgentDetails(agentId);
          model = agentDetails.identity?.model || model;
        } catch (error) {
          // Silenciosamente ignora erro ao obter modelo do agente
        }
      }
      return await prisma.taskExecutionLog.create({
        data: {
          taskId: task.id,
          userId,
          model: model,
          startedAt: new Date(),
          success: false
        }
      });
    } catch (error) {
      throw error;
    }
  }

  static async finishExecutionLog(logId, result) {
    try {
      const logEntry = await prisma.taskExecutionLog.findUnique({ where: { id: logId } });
      if (!logEntry) throw new Error('Log não encontrado');
      const durationMs = new Date() - logEntry.startedAt;
      return await prisma.taskExecutionLog.update({
        where: { id: logId },
        data: {
          finishedAt: new Date(),
          durationMs,
          success: result.success || false,
          exitCode: result.exitCode,
          errorMessage: result.errorMessage,
          executionNotes: result.executionNotes
        }
      });
    } catch (error) {
      throw error;
    }
  }

  // Delegações de utilitários (mantidas conforme seu código)
  static detectTaskType(task) { return TaskAnalysisService.detectTaskType(task); }
  static requiresReport(task) { return TaskAnalysisService.requiresReport(task); }
  static resolveProjectPath(basePath, subPath) { return resolveProjectPath(basePath, subPath); }
  static isPathInside(targetPath, basePath) { return isPathInside(targetPath, basePath); }
  static formatNumberedList(items, emptyFallback = 'Nenhum item definido.') { return formatNumberedList(items, emptyFallback); }
  static formatInlineList(items, emptyFallback = 'nenhum') { return formatInlineList(items, emptyFallback); }
  static async fileExists(filePath) { return fileExists(filePath); }
  static printDebugBlock(title, data) { return printDebugBlock(title, data); }
  static normalizeFsPath(filePath, baseDir = process.cwd()) { return normalizeFsPath(filePath, baseDir); }
  static extractPathTokensFromCommand(command) { return extractPathTokensFromCommand(command); }
  static normalizeCommandSignature(command) { return normalizeCommandSignature(command); }
  static isInspectionCommand(command) { return isInspectionCommand(command); }
  static isMutationCommand(command) { return isMutationCommand(command); }
  static commandTargetsOnlySpecialFiles(command, specialFiles = [], cwd = process.cwd()) { return commandTargetsOnlySpecialFiles(command, specialFiles, cwd); }
  static isMeaningfulCommand(command, specialFiles = [], cwd = process.cwd()) { return isMeaningfulCommand(command, specialFiles, cwd); }
  static applyExecutionEvidence(executionEvidence, toolName, toolResult = {}, options = {}) { return EvidenceService.applyExecutionEvidence(executionEvidence, toolName, toolResult, options); }
  static buildTurnSignature(executionResult) { return ToolCallService.buildTurnSignature(executionResult); }
  static detectRepeatedActionLoop(signatures, maxPatternSize = 12, repetitions = 3) { return ToolCallService.detectRepeatedActionLoop(signatures, maxPatternSize, repetitions); }
  static analyzeTaskScope(task, project) { return TaskAnalysisService.analyzeTaskScope(task, project); }
  static extractJsonObjects(text) { return extractJsonObjects(text); }
  static inspectJsonLikeStructure(text) { return inspectJsonLikeStructure(text); }
  static getLikelyToolNameFromText(text) { return ToolCallService.getLikelyToolNameFromText(text); }
  static detectTruncatedToolCall(text) { return ToolCallService.detectTruncatedToolCall(text); }
  static normalizeToolCall(parsed) { return ToolCallService.normalizeToolCall(parsed); }
  static extractToolCallFromText(text) { return ToolCallService.extractToolCallFromText(text); }

  static async prepareTaskFiles(task, tasksDir, project = null, analysisPlan = null) {
    const taskId = task.id;
    const promptFile = path.join(tasksDir, `prompt-${taskId}.txt`);
    const relatorioFile = path.join(tasksDir, `relatorio-${taskId}.txt`);
    const doneFile = path.join(tasksDir, `done-${taskId}.done`);
    const terminalLogFile = path.join(tasksDir, `terminal-${taskId}.log`);

    // === NOVOS ARQUIVOS MAPEADOS AQUI ===
    const architectPlanFile = path.join(tasksDir, `plano-arquiteto-${taskId}.txt`);
    const architectLogFile = path.join(tasksDir, `terminal-arquiteto-${taskId}.log`);

    let resolvedProject = project;
    if (!resolvedProject && task.projectId) {
      try { resolvedProject = await prisma.project.findUnique({ where: { id: task.projectId } }); } catch (e) {}
    }
    const resolvedAnalysisPlan = analysisPlan || await TaskAnalysisService.analyzeTaskScope(task, resolvedProject);
    const dirBase = resolvedProject?.pastaBase || 'Diretório atual';
    const engineRules = `
[REGRA DE OURO]
1. NÃO ADIVINHE CAMINHOS. Use 'find' ou 'ls'.
2. PROIBIDO FAZER BACKUPS: Edite os arquivos originais DIRETAMENTE. Não crie cópias de segurança (sem extensões .bak, .orig, .old ou ~). O projeto já possui controle de versão (Git) garantindo a segurança.
3. SÓ FINALIZE criando o arquivo .done QUANDO TUDO ESTIVER CONCLUÍDO.
QUANDO TERMINAR:
1. Escreva em: ${relatorioFile}
2. Use: {"name": "exec", "arguments": {"command": "touch ${doneFile}"}}`;

    const promptContent = `Agente Jarbas. TAREFA: ${task.title}. DESC: ${task.description}. BASE: ${dirBase}. ${engineRules}`;
    await fs.writeFile(promptFile, promptContent);
    await fs.writeFile(relatorioFile, '');
    await fs.writeFile(terminalLogFile, '');
    return { promptFile, relatorioFile, doneFile, terminalLogFile, promptContent, analysisPlan: resolvedAnalysisPlan };
  }

  static async verifyContract(doneFile, relatorioFile, terminalLogFile, options = {}) {
    return ContractVerificationService.verifyContract(doneFile, relatorioFile, terminalLogFile, options);
  }

  static async runBuildValidationIfNeeded(project, evidence) {
    if (!project) return { passed: true };

    // Adicionamos um timeout de 60 segundos (60000ms) para evitar travamento infinito
    const BUILD_TIMEOUT = 60000;

    if (project.backendBuildCmd && project.backendPath) {
      try {
        console.log(`⏳ Testando build do Backend: ${project.backendBuildCmd}...`);
        const backDir = path.join(project.pastaBase, project.backendPath);
        
        // O timeout impede que comandos como 'npm start' congelem o Node
        execSync(project.backendBuildCmd, { cwd: backDir, stdio: 'pipe', timeout: BUILD_TIMEOUT });
      } catch (e) { 
        console.log(`❌ Build do Backend reprovou.`);
        return { passed: false, message: `Build do Backend falhou ou excedeu o limite de tempo: ${e.message}` }; 
      }
    }

    if (project.frontendBuildCmd && project.frontendPath) {
      try {
        console.log(`⏳ Testando build do Frontend: ${project.frontendBuildCmd}...`);
        const frontDir = path.join(project.pastaBase, project.frontendPath);
        
        execSync(project.frontendBuildCmd, { cwd: frontDir, stdio: 'pipe', timeout: BUILD_TIMEOUT });
      } catch (e) { 
        console.log(`❌ Build do Frontend reprovou.`);
        return { passed: false, message: `Build do Frontend falhou ou excedeu o limite de tempo: ${e.message}` }; 
      }
    }

    console.log(`✅ Testes de Build passaram com sucesso!`);
    return { passed: true };
  }

  static async executeTask(task, userId, config) {
    const { TASKS_DIR, TASK_TIMEOUT_MS = 14400000 } = config;
    let executionLog = await this.createExecutionLog(task, userId, task.agent);
    let files = null;
    
    try {
      const project = task.projectId ? await prisma.project.findUnique({ where: { id: task.projectId } }) : null;
      
      // FIX 1: A chamada agora possui o "await" obrigatório por causa da IA
      const analysisPlan = await TaskAnalysisService.analyzeTaskScope(task, project);
      
      files = await this.prepareTaskFiles(task, TASKS_DIR, project, analysisPlan);

      const initialSnapshot = await WorkspaceSnapshotService.takeSnapshot(project?.pastaBase || TASKS_DIR);
      let currentInput = files.promptContent; // Variável para manter o prompt atualizado a cada turno
      
      // === NOVO: O AGENTE ARQUITETO ENTRA EM AÇÃO ===
      if (analysisPlan.taskType === 'development') {
        const planFile = path.join(TASKS_DIR, `plano-arquiteto-${task.id}.txt`);
        const architectLogFile = path.join(TASKS_DIR, `terminal-arquiteto-${task.id}.log`);
        const fileList = Array.from(initialSnapshot.keys());
        
        // Constrói o prompt mandando ele escrever no planFile
        const architectInput = PromptFactory.buildArchitectPrompt(task, project, fileList, planFile);

        console.log(`🧠 [Arquiteto] Avaliando a tarefa ${task.id} e montando o plano de ação...`);

        // Chama o OpenClawService com um agente de planejamento (ex: 'architect' ou 'planner')
        // Passamos um timeout menor (ex: 5 minutos) pois ele só precisa escrever um arquivo e sair
        await OpenClawService.execute(
          `${task.id}-architect`, // Sessão diferente para não misturar logs
          architectInput, 
          'estagiario',            // Nome do agente no seu OpenClaw (crie um com esse nome se não tiver)
          null,                   // Usa o modelo padrão
          TASKS_DIR, 
          architectLogFile, 
          project?.pastaBase, 
          300000                  // Timeout de 5 min
        );
        // === A TRAVA DE SEGURANÇA ===
        // Se o Arquiteto foi intrometido e criou o .done, apagamos ele!
        await fs.unlink(files.doneFile).catch(() => {});
        // ============================

        console.log(`🧠 [Arquiteto] finalizou a análise.`);
        // Verifica se o Arquiteto fez o dever de casa e escreveu o plano
        const planExists = await fileExists(planFile);
        let architectPlan = "O arquiteto não conseguiu gerar um plano detalhado. Siga a descrição original da tarefa.";
        
        if (planExists) {
           architectPlan = await fs.readFile(planFile, 'utf8');
        }

        // Anexa o plano do Arquiteto no prompt que vai para o Desenvolvedor
        files.promptContent += `\n\n=== PLANO DE AÇÃO DO ARQUITETO ===\nSiga estritamente estes passos técnicos para concluir a tarefa:\n${architectPlan}`;
        
        // Sobrescreve o arquivo de prompt com as novas instruções
        await fs.writeFile(files.promptFile, files.promptContent);
        
      }
      // === FIM DA AÇÃO DO ARQUITETO ===
      
      
      const evidence = EvidenceService.createEmptyEvidence();
      
      let contractResult = { contractFulfilled: false };
      let turnos = 0; 
      let turnosSemProgresso = 0;
      currentInput = files.promptContent;

      while (!contractResult.contractFulfilled && turnos < 100) {
        turnos++;
        
        // Chamada via o novo OpenClawService
        const res = await OpenClawService.execute(
          task.id, currentInput, task.agent || 'main', null, TASKS_DIR, files.terminalLogFile, project?.pastaBase, TASK_TIMEOUT_MS
        );
        
        EvidenceService.applyExecutionEvidence(
          evidence, res.toolCall, res.toolResult || {}, { executionDirectory: project?.pastaBase || TASKS_DIR }
        );
        
        contractResult = await ContractVerificationService.verifyContract(files.doneFile, files.relatorioFile, files.terminalLogFile, { 
          taskType: analysisPlan.taskType, 
          evidence,
          task,
          project,
          analysisPlan,
          initialSnapshot
        });
        
        if (contractResult.contractFulfilled) {
          const qa = await this.runBuildValidationIfNeeded(project, evidence);
          if (!qa.passed) {
            await fs.unlink(files.doneFile).catch(()=>{});
            currentInput = `Build falhou: ${qa.message}. Corrija e finalize novamente com .done.`;
            contractResult.contractFulfilled = false;
            continue;
          }
          break;
        }

        // FIX 2: Restauração da lógica que apaga o arquivo .done se a validação falhou
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
          contractResult.executionNotes = 'Estagnação.'; 
          break; 
        }
      }

      const finalResult = { success: contractResult.contractFulfilled, executionNotes: contractResult.executionNotes };
      await this.finishExecutionLog(executionLog.id, finalResult);
      return { ...finalResult, taskId: task.id };
      
    } catch (error) {
      if (executionLog) await this.finishExecutionLog(executionLog.id, { success: false, errorMessage: error.message });
      throw error;
    }
  }
}

module.exports = TaskExecutionService;