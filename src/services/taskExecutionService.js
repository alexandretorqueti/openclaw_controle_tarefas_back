const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { spawn, execSync } = require('child_process');
const CommandExecutor = require('./commandExecutor');
const agentService = require('./agentService');

// Importação dos serviços modularizados
const ContractVerificationService = require('./contractVerificationService');
const EvidenceService = require('./evidenceService');
const TaskAnalysisService = require('./taskAnalysisService');
const ToolCallService = require('./toolCallService');

// Importação de utilitários
const { mergeUniquePaths, uniquePaths, resolveProjectPath, isPathInside, normalizeFsPath, extractPathTokensFromCommand } = require('../utils/pathUtils');
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
          console.warn(`⚠️ Não foi possível obter modelo do agente ${agentId}: ${error.message}`);
        }
      }
      const executionLog = await prisma.taskExecutionLog.create({
        data: {
          taskId: task.id,
          userId,
          model: model,
          startedAt: new Date(),
          success: false
        }
      });
      return executionLog;
    } catch (error) {
      console.error(`❌ Erro ao criar log de execução: ${error.message}`);
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

  // Delega para TaskAnalysisService
  static detectTaskType(task) {
    return TaskAnalysisService.detectTaskType(task);
  }

  // Delega para TaskAnalysisService
  static requiresReport(task) {
    return TaskAnalysisService.requiresReport(task);
  }

  // Delega para pathUtils
  static resolveProjectPath(basePath, subPath) {
    return resolveProjectPath(basePath, subPath);
  }

  // Delega para pathUtils
  static isPathInside(targetPath, basePath) {
    return isPathInside(targetPath, basePath);
  }

  // Delega para formatUtils
  static formatNumberedList(items, emptyFallback = 'Nenhum item definido.') {
    return formatNumberedList(items, emptyFallback);
  }

  // Delega para formatUtils
  static formatInlineList(items, emptyFallback = 'nenhum') {
    return formatInlineList(items, emptyFallback);
  }

  // Delega para fileUtils
  static async fileExists(filePath) {
    return fileExists(filePath);
  }

  // Delega para formatUtils
  static printDebugBlock(title, data) {
    return printDebugBlock(title, data);
  }

  // Delega para pathUtils
  static normalizeFsPath(filePath, baseDir = process.cwd()) {
    return normalizeFsPath(filePath, baseDir);
  }

  // Delega para pathUtils
  static extractPathTokensFromCommand(command) {
    return extractPathTokensFromCommand(command);
  }

  // Delega para commandUtils
  static normalizeCommandSignature(command) {
    return normalizeCommandSignature(command);
  }

  // Delega para commandUtils
  static isInspectionCommand(command) {
    return isInspectionCommand(command);
  }

  // Delega para commandUtils
  static isMutationCommand(command) {
    return isMutationCommand(command);
  }

  // Delega para commandUtils
  static commandTargetsOnlySpecialFiles(command, specialFiles = [], cwd = process.cwd()) {
    return commandTargetsOnlySpecialFiles(command, specialFiles, cwd);
  }

  // Delega para commandUtils
  static isMeaningfulCommand(command, specialFiles = [], cwd = process.cwd()) {
    return isMeaningfulCommand(command, specialFiles, cwd);
  }

  // Delega para EvidenceService
  static applyExecutionEvidence(executionEvidence, toolName, toolResult = {}, options = {}) {
    return EvidenceService.applyExecutionEvidence(executionEvidence, toolName, toolResult, options);
  }

  // Delega para ToolCallService
  static buildTurnSignature(executionResult) {
    return ToolCallService.buildTurnSignature(executionResult);
  }

  // Delega para ToolCallService
  static detectRepeatedActionLoop(signatures, maxPatternSize = 12, repetitions = 3) {
    return ToolCallService.detectRepeatedActionLoop(signatures, maxPatternSize, repetitions);
  }

  // Delega para TaskAnalysisService
  static analyzeTaskScope(task, project) {
    return TaskAnalysisService.analyzeTaskScope(task, project);
  }

  // Delega para jsonUtils
  static extractJsonObjects(text) {
    return extractJsonObjects(text);
  }

  // Delega para jsonUtils
  static inspectJsonLikeStructure(text) {
    return inspectJsonLikeStructure(text);
  }

  // Delega para ToolCallService
  static getLikelyToolNameFromText(text) {
    return ToolCallService.getLikelyToolNameFromText(text);
  }

  // Delega para ToolCallService
  static detectTruncatedToolCall(text) {
    return ToolCallService.detectTruncatedToolCall(text);
  }

  // Delega para ToolCallService
  static normalizeToolCall(parsed) {
    return ToolCallService.normalizeToolCall(parsed);
  }

  // Delega para ToolCallService
  static extractToolCallFromText(text) {
    return ToolCallService.extractToolCallFromText(text);
  }

  static async prepareTaskFiles(task, tasksDir, project = null, analysisPlan = null) {
    const taskId = task.id;
    const promptFile = path.join(tasksDir, `prompt-${taskId}.txt`);
    const relatorioFile = path.join(tasksDir, `relatorio-${taskId}.txt`);
    const doneFile = path.join(tasksDir, `done-${taskId}.done`);
    const terminalLogFile = path.join(tasksDir, `terminal-${taskId}.log`);
    let resolvedProject = project;
    if (!resolvedProject && task.projectId) {
      try { resolvedProject = await prisma.project.findUnique({ where: { id: task.projectId } }); } catch (e) {}
    }
    const resolvedAnalysisPlan = analysisPlan || TaskAnalysisService.analyzeTaskScope(task, resolvedProject);
    const dirBase = resolvedProject?.pastaBase || 'Diretório atual';
    const engineRules = `
[REGRA DE OURO]
1. NÃO ADIVINHE CAMINHOS. Use 'find' ou 'ls'.
2. SÓ FINALIZE criando o arquivo .done QUANDO TUDO ESTIVER CONCLUÍDO.
QUANDO TERMINAR:
1. Escreva em: ${relatorioFile}
2. Use: {"name": "exec", "arguments": {"command": "touch ${doneFile}"}}`;

    const promptContent = `Agente Jarbas. TAREFA: ${task.title}. DESC: ${task.description}. BASE: ${dirBase}. ${engineRules}`;
    await fs.writeFile(promptFile, promptContent);
    await fs.writeFile(relatorioFile, '');
    await fs.writeFile(terminalLogFile, '');
    return { promptFile, relatorioFile, doneFile, terminalLogFile, promptContent, analysisPlan: resolvedAnalysisPlan };
  }

  static async executeOpenClaw(taskId, inputMessage, agent, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 14400000) {
    return new Promise((resolve) => {
      const childArgs = ['agent', '--agent', agent, '--session-id', taskId, '-m', inputMessage, '--timeout', Math.floor(timeoutMs / 1000).toString()];
      const env = { ...process.env };
      delete env.NODE_OPTIONS;
      if (model && !model.includes('deepseek-chat')) env.OPENCLAW_MODEL = model;
      const child = spawn('openclaw', childArgs, { cwd: projectPath || tasksDir, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = ''; let streamBuffer = ''; let isSettled = false; let toolStarted = false;
      const settle = (result) => { if (isSettled) return; isSettled = true; clearTimeout(timeoutTimer); resolve(result); };
      const timeoutTimer = setTimeout(() => {
        if (toolStarted) return;
        try { child.kill('SIGKILL'); } catch (_) {}
        settle({ success: false, errorMessage: `Timeout ${timeoutMs}ms`, rawOutput: stdout + stderr });
      }, timeoutMs);
      const onData = async (data, source) => {
        if (isSettled) return;
        const text = data.toString();
        source === 'stdout' ? (stdout += text) : (stderr += text);
        streamBuffer += text;
        fs.appendFile(terminalLogFile, text).catch(() => {});
        const toolCall = ToolCallService.extractToolCallFromText(streamBuffer);
        if (toolCall && !toolStarted) {
          toolStarted = true;
          try { child.kill('SIGKILL'); } catch (_) {}
          const result = await CommandExecutor.executeTool(toolCall, projectPath || tasksDir);
          settle({ success: result.success, toolFeedback: `[RESULTADO] ${result.output || result.error}`, toolCall, toolResult: result, rawOutput: stdout + stderr });
        }
      };
      child.stdout.on('data', (d) => onData(d, 'stdout'));
      child.stderr.on('data', (d) => onData(d, 'stderr'));
      child.on('close', (code) => { if (!toolStarted) settle({ success: code === 0, rawOutput: stdout + stderr, errorMessage: code === 0 ? null : `Erro ${code}` }); });
    });
  }

  // Delega para ContractVerificationService (versão completa com validações)
  static async verifyContract(doneFile, relatorioFile, terminalLogFile, options = {}) {
    return ContractVerificationService.verifyContract(doneFile, relatorioFile, terminalLogFile, options);
  }

  static async runBuildValidationIfNeeded(project, evidence) {
    if (!project || !project.backendBuildCmd) return { passed: true };
    try {
      execSync(project.backendBuildCmd, { cwd: project.pastaBase, stdio: 'pipe' });
      return { passed: true };
    } catch (e) { return { passed: false, message: e.message }; }
  }

  static async executeTask(task, userId, config) {
    const { TASKS_DIR, TASK_TIMEOUT_MS = 14400000 } = config;
    let executionLog = await this.createExecutionLog(task, userId, task.agent);
    let files = null;
    try {
      const project = task.projectId ? await prisma.project.findUnique({ where: { id: task.projectId } }) : null;
      const analysisPlan = TaskAnalysisService.analyzeTaskScope(task, project);
      files = await this.prepareTaskFiles(task, TASKS_DIR, project, analysisPlan);
      const evidence = EvidenceService.createEmptyEvidence();
      let contractResult = { contractFulfilled: false };
      let turnos = 0; let turnosSemProgresso = 0;
      let currentInput = files.promptContent;
      while (!contractResult.contractFulfilled && turnos < 100) {
        turnos++;
        const res = await this.executeOpenClaw(task.id, currentInput, task.agent || 'main', null, TASKS_DIR, files.terminalLogFile, project?.pastaBase, TASK_TIMEOUT_MS);
        
        // Usa EvidenceService para aplicar evidências
        EvidenceService.applyExecutionEvidence(evidence, res.toolCall?.name, res.toolResult || {}, { executionDirectory: project?.pastaBase || TASKS_DIR });
        
        // Usa ContractVerificationService para verificação completa do contrato
        contractResult = await ContractVerificationService.verifyContract(files.doneFile, files.relatorioFile, files.terminalLogFile, { 
          taskType: analysisPlan.taskType, 
          evidence,
          task,
          project,
          analysisPlan
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
        currentInput = res.toolFeedback || res.rawOutput || 'Continue.';
        
        // Usa EvidenceService para calcular progresso do turno
        const prog = EvidenceService.computeTurnProgress(res.toolResult || {}, contractResult, project?.pastaBase || TASKS_DIR);
        prog.hasMeaningfulProgress ? (turnosSemProgresso = 0) : turnosSemProgresso++;
        if (turnosSemProgresso >= 6) { contractResult.executionNotes = 'Estagnação.'; break; }
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
