const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { spawn, execSync } = require('child_process');
const CommandExecutor = require('./commandExecutor');
const agentService = require('./agentService');

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

  static detectTaskType(task) {
    const text = `${task?.title || ''}\n${task?.description || ''}`.toLowerCase();
    if (/(análise|analise|documenta|diagnóstic|diagnostic|levantamento|mapeamento|passo a passo|explique|descreva|resuma|gere um texto|retorne um texto)/i.test(text)) {
      return 'analysis';
    }
    if (/(implementar|corrigir|ajustar|refatorar|alterar|adicionar|criar endpoint|endpoint|controller|service|validator|frontend|backend|api|build|tela|componente|campo|schema|migration|migrat)/i.test(text)) {
      return 'development';
    }
    return 'automation';
  }

  static requiresReport(task) {
    const text = `${task?.title || ''}\n${task?.description || ''}`.toLowerCase();
    return /(relatório|relatorio|gere um texto|retorne um texto|passo a passo|documente|explique|descreva|resuma|diagnóstico|diagnostico)/i.test(text);
  }

  static resolveProjectPath(basePath, subPath) {
    if (!subPath) return null;
    if (path.isAbsolute(subPath)) return path.resolve(subPath);
    if (!basePath) return path.resolve(subPath);
    return path.resolve(basePath, subPath);
  }

  static isPathInside(targetPath, basePath) {
    if (!targetPath || !basePath) return false;
    const normalizedTarget = path.resolve(targetPath);
    const normalizedBase = path.resolve(basePath);
    return (normalizedTarget === normalizedBase || normalizedTarget.startsWith(normalizedBase + path.sep));
  }

  static formatNumberedList(items, emptyFallback = 'Nenhum item definido.') {
    if (!items || items.length === 0) return `1. ${emptyFallback}`;
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }

  static formatInlineList(items, emptyFallback = 'nenhum') {
    if (!items || items.length === 0) return emptyFallback;
    return items.join(', ');
  }

  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (_) {
      return false;
    }
  }

  static printDebugBlock(title, data) {
    console.log(`\n================ [DEBUG][${title}] ================`);
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    console.log(`================ [FIM DEBUG][${title}] ================\n`);
  }

  static normalizeFsPath(filePath, baseDir = process.cwd()) {
    if (!filePath || typeof filePath !== 'string') return null;
    let normalized = filePath.trim().replace(/^['"`]/, '').replace(/['"`]$/, '');
    if (!normalized) return null;
    if (normalized.startsWith('~')) {
      const home = process.env.HOME || '';
      normalized = path.join(home, normalized.slice(1));
    }
    return path.isAbsolute(normalized) ? path.resolve(normalized) : path.resolve(baseDir || process.cwd(), normalized);
  }

  static extractPathTokensFromCommand(command) {
    if (!command || typeof command !== 'string') return [];
    const tokens = [];
    const regex = /(["'`])([^"'`\n]*\/[^"'`\n]*)\1|((?:\/|\.{1,2}\/|[A-Za-z0-9_.-]+\/)[^\s|;&]+)/g;
    let match;
    while ((match = regex.exec(command)) !== null) {
      const raw = (match[2] || match[3] || '').trim();
      if (!raw) continue;
      const cleaned = raw.replace(/[),:]+$/g, '');
      if (cleaned) tokens.push(cleaned);
    }
    return Array.from(new Set(tokens));
  }

  static normalizeCommandSignature(command) {
    if (!command || typeof command !== 'string') return '';
    return command.trim().replace(/\s+/g, ' ').replace(/["']/g, '').toLowerCase();
  }

  static isInspectionCommand(command) {
    if (!command || typeof command !== 'string') return false;
    return /(^|\s)(find|grep|sed\s+-n|cat|ls|pwd|head|tail|awk|rg)\b/i.test(command);
  }

  static isMutationCommand(command) {
    if (!command || typeof command !== 'string') return false;
    return (
      /\bsed\s+-i\b/i.test(command) || /\bperl\s+-pi\b/i.test(command) ||
      /^\s*touch\b/i.test(command) || /^\s*rm\b/i.test(command) ||
      /^\s*mv\b/i.test(command) || /^\s*cp\b/i.test(command) ||
      /\btee\b/i.test(command) || /(^|[^0-9])>>?\s*["'`]?[^"'`\s|;&]+["'`]?/i.test(command)
    );
  }

  static commandTargetsOnlySpecialFiles(command, specialFiles = [], cwd = process.cwd()) {
    if (!command || typeof command !== 'string') return false;
    const resolvedSpecialFiles = new Set((specialFiles || []).filter(Boolean).map((file) => path.resolve(file)));
    const commandPaths = this.extractPathTokensFromCommand(command).map((token) => this.normalizeFsPath(token, cwd)).filter(Boolean);
    if (commandPaths.length === 0) return false;
    return commandPaths.every((file) => resolvedSpecialFiles.has(path.resolve(file)));
  }

  static isMeaningfulCommand(command, specialFiles = [], cwd = process.cwd()) {
    if (!command || typeof command !== 'string') return false;
    const normalized = this.normalizeCommandSignature(command);
    if (!normalized || normalized === 'pwd' || /^ls( -[a-z0-9]+)*$/.test(normalized)) return false;
    if (this.commandTargetsOnlySpecialFiles(command, specialFiles, cwd)) return false;
    return true;
  }

  static inferEvidenceFromCommand(command, executionDirectory) {
    return parseCommandEvidence(command, executionDirectory);
  }

  static applyExecutionEvidence(executionEvidence, toolName, toolResult = {}, options = {}) {
    const executionDirectory = options.executionDirectory || process.cwd();
    executionEvidence.toolsUsed = executionEvidence.toolsUsed || [];
    executionEvidence.filesRead = mergeUniquePaths(executionEvidence.filesRead || [], toolResult.filesRead || []);
    executionEvidence.filesWritten = mergeUniquePaths(executionEvidence.filesWritten || [], toolResult.filesWritten || []);
    executionEvidence.modifiedFiles = mergeUniquePaths(executionEvidence.modifiedFiles || [], toolResult.modifiedFiles || []);
    executionEvidence.touchedFiles = mergeUniquePaths(executionEvidence.touchedFiles || [], toolResult.touchedFiles || []);
    executionEvidence.commandsExecuted = Array.from(new Set([...(executionEvidence.commandsExecuted || []), ...((toolResult.commandsExecuted || []).filter(Boolean))]));

    if (toolName && !executionEvidence.toolsUsed.includes(toolName)) executionEvidence.toolsUsed.push(toolName);

    if (toolName === 'exec') {
      for (const command of toolResult.commandsExecuted || []) {
        const inferred = parseCommandEvidence(command, executionDirectory);
        executionEvidence.filesRead = mergeUniquePaths(executionEvidence.filesRead || [], inferred.filesRead || []);
        executionEvidence.modifiedFiles = mergeUniquePaths(executionEvidence.modifiedFiles || [], inferred.modifiedFiles || []);
        executionEvidence.touchedFiles = mergeUniquePaths(executionEvidence.touchedFiles || [], inferred.touchedFiles || []);
      }
      if (toolResult.executionDiagnostics?.noOpMutation) {
        executionEvidence.noOpMutations = [...(executionEvidence.noOpMutations || []), {
          command: toolResult.commandsExecuted?.[0] || null,
          candidateFiles: uniquePaths(toolResult.executionDiagnostics.candidateFiles || []),
        }];
      }
    }
    return executionEvidence;
  }

  static buildTurnSignature(executionResult) {
    if (executionResult?.toolCall?.name === 'exec') {
      return normalizeActionSignature('exec', executionResult.toolResult || {}, executionResult.toolCall?.arguments?.command || '');
    }
    if (executionResult?.toolCall?.name === 'read') return `read:${executionResult.toolCall.arguments?.file_path || ''}`;
    if (executionResult?.toolCall?.name === 'write') return `write:${executionResult.toolCall.arguments?.file_path || ''}`;
    if (executionResult?.toolCall?.name === 'edit') return `edit:${executionResult.toolCall.arguments?.file_path || ''}`;
    if (executionResult?.truncatedToolInfo?.detected) return `truncated:${executionResult.truncatedToolInfo.likelyTool}:${executionResult.truncatedToolInfo.reason}`;
    if (executionResult?.rawOutput) return `raw:${executionResult.rawOutput.trim().replace(/\s+/g, ' ').substring(0, 250)}`;
    return executionResult?.success ? 'success_without_action' : `error:${executionResult?.errorMessage || 'unknown'}`;
  }

  static detectRepeatedActionLoop(signatures, maxPatternSize = 12, repetitions = 3) {
    if (!Array.isArray(signatures) || signatures.length < repetitions) return { detected: false };
    const total = signatures.length;
    const maxSize = Math.min(maxPatternSize, Math.floor(total / repetitions));
    for (let patternSize = 1; patternSize <= maxSize; patternSize++) {
      const tail = signatures.slice(total - patternSize);
      if (tail.some((item) => !item)) continue;
      let repeated = true;
      for (let rep = 2; rep <= repetitions; rep++) {
        const start = total - patternSize * rep;
        const candidate = signatures.slice(start, start + patternSize);
        if (candidate.length !== patternSize || candidate.join('||') !== tail.join('||')) {
          repeated = false;
          break;
        }
      }
      if (repeated) return { detected: true, patternSize, repetitions, pattern: tail };
    }
    return { detected: false };
  }

  static analyzeTaskScope(task, project) {
    const rawText = `${task?.title || ''}\n${task?.description || ''}`;
    const text = rawText.toLowerCase();
    const baseTaskType = this.detectTaskType(task);
    const expectedLayers = new Set();
    const requiredModifiedLayers = new Set();
    const finalizationInstructions = ['Escrever o resultado final no arquivo de relatório.', 'Criar o arquivo .done ao finalizar.'];
    const hasFrontendPath = !!project?.frontendPath;
    const hasBackendPath = !!project?.backendPath;
    const mentionsFrontend = /(frontend|formulário|formulario|tela|ui|componente|input|select|checkbox|modal|página|pagina|view)/i.test(text);
    const mentionsBackend = /(backend|api|controller|service|model|schema|dto|validator|prisma|migration|migrat|banco|repository|repositório)/i.test(text);
    const mentionsCrudFields = /(campo|campos|cadastro|inclusão|inclusao|edição|edicao|formulário|formulario|create|edit|criação|criacao|atualização|atualizacao)/i.test(text);

    if (baseTaskType === 'analysis') {
      return {
        taskType: 'analysis',
        mandatoryChecks: ['Localizar arquivos relevantes.', 'Inspecionar o sistema.', 'Produzir relatório final.'],
        definitionOfDone: ['Evidência real de inspeção.', 'Relatório final escrito.', 'Arquivo .done criado.'],
        finalizationInstructions,
        risks: ['Não concluir com texto genérico.']
      };
    }

    if (baseTaskType === 'development') {
      if (mentionsBackend) expectedLayers.add('backend');
      if (mentionsFrontend) expectedLayers.add('frontend');
      if (expectedLayers.size === 0) {
        if (hasBackendPath) expectedLayers.add('backend');
        else if (hasFrontendPath) expectedLayers.add('frontend');
      }
      if (mentionsBackend && hasBackendPath) requiredModifiedLayers.add('backend');
      if (mentionsFrontend && hasFrontendPath) requiredModifiedLayers.add('frontend');

      return {
        taskType: 'development',
        expectedLayers: Array.from(expectedLayers),
        requiredModifiedLayers: Array.from(requiredModifiedLayers),
        mandatoryChecks: ['Revisar arquivos afetados.', 'Implementar a mudança.', 'Garantir persistência.'],
        definitionOfDone: ['Arquivos alterados.', 'Relatório escrito.', 'Arquivo .done criado.', 'Build validado.'],
        finalizationInstructions,
        risks: ['Não ignorar camadas impactadas.']
      };
    }

    return {
      taskType: 'automation',
      mandatoryChecks: ['Executar ações necessárias.', 'Gerar relatório.', 'Finalizar com .done.'],
      definitionOfDone: ['Evidência de execução.', 'Arquivo .done criado.'],
      finalizationInstructions,
      risks: ['Execução sem evidência real.']
    };
  }

  static extractJsonObjects(text) {
    const results = [];
    let depth = 0; let start = -1; let inString = false; let escape = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (escape) { escape = false; continue; }
      if (char === '\\') { if (inString) escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{') { if (depth === 0) start = i; depth++; }
      else if (char === '}') { depth--; if (depth === 0 && start !== -1) { results.push(text.substring(start, i + 1)); start = -1; } }
    }
    return results;
  }

  static inspectJsonLikeStructure(text) {
    let depth = 0; let inString = false; let escape = false; let sawOpeningBrace = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (escape) { escape = false; continue; }
      if (char === '\\' && inString) { escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{') { sawOpeningBrace = true; depth++; }
      else if (char === '}') { depth = Math.max(0, depth - 1); }
    }
    return { finalDepth: depth, inString, sawOpeningBrace };
  }

  static getLikelyToolNameFromText(text) {
    const m = text.match(/"name"\s*:\s*"(exec|read|write|edit)"/i);
    return m ? m[1].toLowerCase() : null;
  }

  static detectTruncatedToolCall(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed || this.extractToolCallFromText(trimmed)) return null;
    const likelyTool = this.getLikelyToolNameFromText(trimmed);
    const mentionsArgs = /"arguments"\s*:/i.test(trimmed);
    // Sanitizado: Uso de escape para evitar quebra do Markdown no chat
    const regexFenced = new RegExp('\\x60\\x60\\x60(?:json)?', 'i');
    const looksLikeToolJson = (trimmed.includes('{') && mentionsArgs) || !!likelyTool || regexFenced.test(trimmed);
    if (!looksLikeToolJson) return null;
    const structure = this.inspectJsonLikeStructure(trimmed);
    let reason = 'json_invalido_ou_truncado';
    if (structure.inString) reason = 'string_json_nao_foi_fechada';
    else if (structure.finalDepth > 0) reason = 'objeto_json_incompleto';
    else if (trimmed.length > 4000) reason = 'payload_grande_demais';
    return { detected: true, likelyTool: likelyTool || 'desconhecida', reason, preview: trimmed.substring(0, 700) };
  }

  static normalizeToolCall(parsed) {
    if (!parsed || !parsed.name) return null;
    const supported = ['exec', 'read', 'write', 'edit'];
    const name = parsed.name.trim();
    if (!supported.includes(name)) return null;
    const args = parsed.arguments || {};
    if (name === 'exec') return args.command ? { name, arguments: { command: args.command } } : null;
    const filePath = args.file_path || args.path || args.filePath;
    if (!filePath) return null;
    if (name === 'read') return { name, arguments: { file_path: filePath } };
    if (name === 'write') return { name, arguments: { file_path: filePath, content: String(args.content ?? '') } };
    if (name === 'edit') {
      const oldT = args.oldText ?? args.old_text ?? args.oldString;
      const newT = args.newText ?? args.new_text ?? args.newString;
      return (typeof oldT === 'string' && typeof newT === 'string') ? { name, arguments: { file_path: filePath, oldText: oldT, newText: newT } } : null;
    }
    return null;
  }

  static extractToolCallFromText(text) {
    if (!text || !text.trim()) return null;
    const candidates = [];
    // Sanitizado: Uso de escape para crase
    const regexBlocks = new RegExp('\\x60\\x60\\x60(?:json)?\\s*([\\s\\S]*?)\\x60\\x60\\x60', 'gi');
    const fencedBlocks = [...text.matchAll(regexBlocks)];
    for (const match of fencedBlocks) { if (match[1]) candidates.push(match[1].trim()); }
    const jsonObjects = this.extractJsonObjects(text);
    for (const jsonStr of jsonObjects) { candidates.push(jsonStr); }
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const normalized = this.normalizeToolCall(parsed);
        if (normalized) return normalized;
      } catch (_) {}
    }
    return null;
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
    const resolvedAnalysisPlan = analysisPlan || this.analyzeTaskScope(task, resolvedProject);
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
        const toolCall = this.extractToolCallFromText(streamBuffer);
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

  static async verifyContract(doneFile, relatorioFile, terminalLogFile, options = {}) {
    try {
      const doneExists = await this.fileExists(doneFile);
      const relatorioExists = await this.fileExists(relatorioFile);
      let executionNotes = '';
      if (relatorioExists) {
        const content = await fs.readFile(relatorioFile, 'utf8');
        if (content.trim().length > 10) executionNotes = content.trim();
      }
      const { taskType = 'automation', evidence = {} } = options;
      const filesModified = (evidence.modifiedFiles || []).filter(f => f !== doneFile && f !== relatorioFile);
      if (taskType === 'development' && filesModified.length === 0 && !doneExists) return { contractFulfilled: false, feedbackToAgent: 'Nenhuma alteração real detectada.' };
      if (doneExists) return { contractFulfilled: true, executionNotes: executionNotes || 'Concluído.' };
      return { contractFulfilled: false, executionNotes: 'Aguardando .done' };
    } catch (e) { return { contractFulfilled: false, executionNotes: e.message }; }
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
      const analysisPlan = this.analyzeTaskScope(task, project);
      files = await this.prepareTaskFiles(task, TASKS_DIR, project, analysisPlan);
      const evidence = { modifiedFiles: [], filesRead: [], commandsExecuted: [] };
      let contractResult = { contractFulfilled: false };
      let turnos = 0; let turnosSemProgresso = 0;
      let currentInput = files.promptContent;
      while (!contractResult.contractFulfilled && turnos < 100) {
        turnos++;
        const res = await this.executeOpenClaw(task.id, currentInput, task.agent || 'main', null, TASKS_DIR, files.terminalLogFile, project?.pastaBase, TASK_TIMEOUT_MS);
        this.applyExecutionEvidence(evidence, res.toolCall?.name, res.toolResult || {}, { executionDirectory: project?.pastaBase || TASKS_DIR });
        contractResult = await this.verifyContract(files.doneFile, files.relatorioFile, files.terminalLogFile, { taskType: analysisPlan.taskType, evidence });
        
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
        const prog = computeTurnProgress(res.toolResult || {}, contractResult, project?.pastaBase || TASKS_DIR);
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

function uniquePaths(v = []) { return Array.from(new Set((v || []).filter(Boolean).map(p => path.resolve(String(p))))); }
function mergeUniquePaths(c = [], i = []) { return uniquePaths([...c, ...i]); }

function isEphemeralArtifact(filePath = '') {
  const base = path.basename(filePath);
  if (base.endsWith('.done') && !base.startsWith('.')) return false;
  if (base.startsWith('relatorio-') && base.endsWith('.txt')) return false;
  return [/^terminal-.*\.log$/i, /\.lock$/i, /monitor-state\.json$/i].some(r => r.test(base));
}

function shellSplit(input = '') {
  const tokens = []; let current = ''; let quote = null; let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escaped) { current += ch; escaped = false; }
    else if (ch === '\\' && quote !== "'") escaped = true;
    else if (quote) { if (ch === quote) quote = null; else current += ch; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (/\s/.test(ch)) { if (current) { tokens.push(current); current = ''; } }
    else current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function parseCommandEvidence(command = '', cwd = process.cwd()) {
  const tokens = shellSplit(command);
  const evidence = { filesRead: [], modifiedFiles: [] };
  if (!tokens.length) return evidence;
  const exec = path.basename(tokens[0]);
  const last = tokens[tokens.length - 1];
  const maybeFile = (last && !last.startsWith('-')) ? path.resolve(cwd, last) : null;
  if (['cat', 'grep', 'rg', 'head', 'tail'].includes(exec) && maybeFile) evidence.filesRead.push(maybeFile);
  if (['touch', 'rm', 'sed', 'mv', 'cp'].includes(exec) && maybeFile) evidence.modifiedFiles.push(maybeFile);
  const redir = command.match(/>>?\s*(["']?)([^"'>\s]+)\1/);
  if (redir && redir[2]) evidence.modifiedFiles.push(path.resolve(cwd, redir[2]));
  return { filesRead: uniquePaths(evidence.filesRead), modifiedFiles: uniquePaths(evidence.modifiedFiles) };
}

function computeTurnProgress(toolResult = {}, contractResult = {}, cwd = process.cwd()) {
  let inferredReads = []; let inferredMutations = [];
  const cmds = Array.isArray(toolResult.commandsExecuted) ? toolResult.commandsExecuted : [];
  for (const c of cmds) {
    const inf = parseCommandEvidence(c, cwd);
    inferredReads = mergeUniquePaths(inferredReads, inf.filesRead);
    inferredMutations = mergeUniquePaths(inferredMutations, inf.modifiedFiles);
  }
  const hasReads = mergeUniquePaths(toolResult.filesRead || [], inferredReads).filter(f => !isEphemeralArtifact(f)).length > 0;
  const hasMutations = mergeUniquePaths(toolResult.modifiedFiles || [], inferredMutations).filter(f => !isEphemeralArtifact(f)).length > 0;
  const success = !!contractResult.contractFulfilled;
  return { hasMeaningfulProgress: success || hasReads || hasMutations };
}

function normalizeActionSignature(name, res = {}, fallback = '') {
  const cmd = (res.commandsExecuted || [])[0] || fallback || '';
  return `${name}:${cmd.substring(0, 100)}`;
}

module.exports = TaskExecutionService;