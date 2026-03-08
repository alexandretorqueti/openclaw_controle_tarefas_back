// services/taskExecutionService.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { spawn, execSync } = require('child_process');
const CommandExecutor = require('./commandExecutor');

const prisma = new PrismaClient();

class TaskExecutionService {
  static async createExecutionLog(task, userId, model) {
    try {
      const executionLog = await prisma.taskExecutionLog.create({
        data: {
          taskId: task.id,
          userId,
          model: model || task.model || 'deepseek/deepseek-chat',
          startedAt: new Date(),
          success: false
        }
      });

      console.log(`📝 Log de execução criado para tarefa ${task.id}`);
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

  static requiresReport(task) {
    const text = `${task?.title || ''}\n${task?.description || ''}`.toLowerCase();

    return /(relatório|relatorio|gere um texto|retorne um texto|passo a passo|documente|explique|descreva|resuma|diagnóstico|diagnostico)/i.test(text);
  }

  static resolveProjectPath(basePath, subPath) {
    if (!subPath) return null;
    if (path.isAbsolute(subPath)) return subPath;
    if (!basePath) return subPath;
    return path.join(basePath, subPath);
  }

  static isPathInside(targetPath, basePath) {
    if (!targetPath || !basePath) return false;

    const normalizedTarget = path.resolve(targetPath);
    const normalizedBase = path.resolve(basePath);

    return (
      normalizedTarget === normalizedBase ||
      normalizedTarget.startsWith(normalizedBase + path.sep)
    );
  }

  static formatNumberedList(items, emptyFallback = 'Nenhum item definido.') {
    if (!items || items.length === 0) {
      return `1. ${emptyFallback}`;
    }

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
    if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    console.log(`================ [FIM DEBUG][${title}] ================\n`);
  }
  
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
      'Escrever o resultado final no arquivo de relatório.',
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

    if (baseTaskType === 'analysis' || mentionsAnalysis) {
      return {
        taskType: 'analysis',
        expectedLayers: [],
        requiredModifiedLayers: [],
        mandatoryChecks: [
          'Localizar os arquivos ou diretórios relevantes.',
          'Ler ou inspecionar as partes necessárias do sistema.',
          'Produzir um relatório final consistente com base no que foi realmente inspecionado.'
        ],
        definitionOfDone: [
          'Há evidência real de inspeção do sistema.',
          'O relatório final foi escrito.',
          'O arquivo .done foi criado.'
        ],
        finalizationInstructions,
        risks: [
          'Não concluir só com texto genérico sem evidência de leitura ou inspeção.'
        ]
      };
    }

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
        mandatoryChecks.push('Atualizar modelo/schema/DTO/validação/service/controller quando aplicável.');
        mandatoryChecks.push('Garantir que create/edit do backend aceitem e persistam a mudança.');
      }

      if (expectedLayers.has('frontend')) {
        mandatoryChecks.push('Localizar e revisar os arquivos do frontend afetados.');
        mandatoryChecks.push('Atualizar formulário de inclusão/criação quando aplicável.');
        mandatoryChecks.push('Atualizar formulário de edição quando aplicável.');
      }

      if (mentionsListingOrDetails && expectedLayers.has('frontend')) {
        mandatoryChecks.push('Verificar se telas de listagem/detalhes também precisam refletir a mudança.');
      }

      definitionOfDone.push('Arquivos reais do projeto foram alterados.');
      definitionOfDone.push('O relatório final foi escrito.');
      definitionOfDone.push('O arquivo .done foi criado.');
      definitionOfDone.push('A tarefa passou na validação final do orquestrador.');

      if (requiredModifiedLayers.has('backend')) {
        definitionOfDone.push('Há alteração real em arquivos do backend.');
      }

      if (requiredModifiedLayers.has('frontend')) {
        definitionOfDone.push('Há alteração real em arquivos do frontend.');
      }

      if (!hasFrontendPath && (mentionsFrontend || mentionsCrudFields)) {
        risks.push('A tarefa parece afetar frontend, mas o projeto não tem frontendPath configurado.');
      }

      if (!hasBackendPath && (mentionsBackend || mentionsCrudFields)) {
        risks.push('A tarefa parece afetar backend, mas o projeto não tem backendPath configurado.');
      }

      if (risks.length === 0) {
        risks.push('Não concluir a tarefa sem revisar todas as camadas impactadas.');
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

    const automationChecks = [
      'Executar as ações necessárias para cumprir a automação.',
      'Gerar o relatório final quando solicitado.',
      'Finalizar com o arquivo .done.'
    ];

    const automationDone = [
      'Há evidência de execução útil.',
      'O arquivo .done foi criado.'
    ];

    if (this.requiresReport(task)) {
      automationDone.push('O relatório final foi escrito.');
    }

    return {
      taskType: 'automation',
      expectedLayers: [],
      requiredModifiedLayers: [],
      mandatoryChecks: automationChecks,
      definitionOfDone: automationDone,
      finalizationInstructions,
      risks: ['Não concluir sem evidência real de execução útil.']
    };
  }

  static extractJsonObjects(text) {
    const results = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          results.push(text.substring(start, i + 1));
          start = -1;
        }
      }
    }

    return results;
  }

  static normalizeToolCall(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.name || typeof parsed.name !== 'string') return null;

    const supportedTools = ['exec', 'read', 'write', 'edit'];
    const name = parsed.name.trim();

    if (!supportedTools.includes(name)) {
      return null;
    }

    const args = parsed.arguments && typeof parsed.arguments === 'object'
      ? parsed.arguments
      : {};

    if (name === 'exec') {
      if (!args.command || typeof args.command !== 'string') return null;
      return { name, arguments: { command: args.command } };
    }

    if (name === 'read') {
      const filePath = args.file_path || args.path || args.filePath;
      if (!filePath || typeof filePath !== 'string') return null;
      return { name, arguments: { file_path: filePath } };
    }

    if (name === 'write') {
      const filePath = args.file_path || args.path || args.filePath;
      if (!filePath || typeof filePath !== 'string') return null;
      return { name, arguments: { file_path: filePath, content: args.content ?? '' } };
    }

    if (name === 'edit') {
      const filePath = args.file_path || args.path || args.filePath;
      const oldText = args.oldText ?? args.old_text ?? args.oldString;
      const newText = args.newText ?? args.new_text ?? args.newString;

      if (!filePath || typeof filePath !== 'string') return null;
      if (typeof oldText !== 'string') return null;
      if (typeof newText !== 'string') return null;

      return {
        name,
        arguments: {
          file_path: filePath,
          oldText,
          newText
        }
      };
    }

    return null;
  }

  static extractToolCallFromText(text) {
    if (!text || !text.trim()) return null;

    const candidates = [];

    const fencedBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    for (const match of fencedBlocks) {
      if (match[1] && match[1].trim()) {
        candidates.push(match[1].trim());
      }
    }

    const jsonObjects = this.extractJsonObjects(text);
    for (const jsonStr of jsonObjects) {
      candidates.push(jsonStr);
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const normalized = this.normalizeToolCall(parsed);
        if (normalized) return normalized;
      } catch (_) {
        // ignora candidatos inválidos
      }
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
      try {
        resolvedProject = await prisma.project.findUnique({
          where: { id: task.projectId }
        });
      } catch (e) {
        console.error(`Erro ao buscar projeto: ${e.message}`);
      }
    }

    const resolvedAnalysisPlan = analysisPlan || this.analyzeTaskScope(task, resolvedProject);

    const personaPrompt = 'Você é o Agente Técnico Jarbas.';
    const baseRules = '';
    const dirBase = resolvedProject?.pastaBase || 'Diretório atual';
    const dirFront = resolvedProject?.frontendPath || 'Não definido';
    const dirBack = resolvedProject?.backendPath || 'Não definido';

    const architectureMap = `
[ARQUITETURA DO PROJETO]
Você está rodando o terminal na pasta base: ${dirBase}
- O código do Frontend está em: ${dirFront}
- O código do Backend está em: ${dirBack}

ATENÇÃO:
- Não procure arquivos genéricos na raiz sem necessidade.
- Direcione seus comandos 'find', 'grep', 'ls' e 'sed' para as pastas corretas acima.
- Se a tarefa for de desenvolvimento, só finalize depois de alterar os arquivos reais necessários do projeto.
`;

    const scopeAnalysisBlock = `
[PRÉ-ANÁLISE DE ESCOPO]
Tipo detectado: ${resolvedAnalysisPlan.taskType}
Camadas esperadas: ${this.formatInlineList(resolvedAnalysisPlan.expectedLayers, 'nenhuma')}
Camadas que DEVEM ter alteração real: ${this.formatInlineList(resolvedAnalysisPlan.requiredModifiedLayers, 'nenhuma obrigatória')}

Checklist obrigatório:
${this.formatNumberedList(resolvedAnalysisPlan.mandatoryChecks)}

Definição de pronto:
${this.formatNumberedList(resolvedAnalysisPlan.definitionOfDone)}

Instruções de finalização:
${this.formatNumberedList(resolvedAnalysisPlan.finalizationInstructions)}

Riscos comuns:
${this.formatNumberedList(resolvedAnalysisPlan.risks)}
`;

    const projectSpecificRules = resolvedProject?.regras
      ? resolvedProject.regras
      : 'Nenhuma regra específica definida.';

    const combinedRules = [baseRules, projectSpecificRules]
      .filter((r) => r && r.trim() !== '')
      .join('\n\n');

    const engineRules = `[REGRA DE OURO - PROIBIDO ADIVINHAR CAMINHOS]
1. Você NÃO PODE adivinhar nomes de arquivos.
2. OBRIGATÓRIO: Seu primeiro comando deve usar "exec" com 'find', 'ls -la' ou comando equivalente direcionado às pastas da Arquitetura do Projeto.
3. [REGRA ANTI-LOOP]: Se um comando não retornar nada, É PROIBIDO repeti-lo. Use 'ls -la' ou 'pwd' para entender onde você está.
4. Se a tarefa for de desenvolvimento, relatório e arquivo .done NÃO substituem implementação real.
5. Se a tarefa for de análise, o relatório final deve refletir o que foi realmente inspecionado.
6. Respeite obrigatoriamente a [PRÉ-ANÁLISE DE ESCOPO].
7. Se a pré-análise indicar frontend e backend, você NÃO pode concluir a tarefa mexendo em apenas uma das camadas.
8. Antes de concluir, confira se todos os itens da Definição de pronto foram realmente atendidos.

[COMO USAR FERRAMENTAS]
Emita UM JSON estrito em uma nova linha com o formato:
{"name": "nome_da_ferramenta", "arguments": {"parametro": "valor"}}

### DICAS DE SOBREVIVÊNCIA NO TERMINAL (MUITO IMPORTANTE) ###
1. ARQUIVOS GRANDES: Se você tentar usar "read" e receber o aviso de que o arquivo foi cortado por ser muito grande, NÃO tente ler de novo. Use a ferramenta "exec" com o comando [sed -n 'LINHA_INICIAL,LINHA_FINALp' /caminho/do/arquivo] para ler apenas as linhas ao redor de onde você precisa alterar.
2. EDIÇÃO PRECISA: A ferramenta "edit" exige que o 'oldText' seja uma cópia EXATA (com espaços e quebras de linha). Se o "edit" falhar várias vezes, use a ferramenta "exec" com o comando [sed -i 's/texto_velho/texto_novo/g' /caminho/do/arquivo] para forçar a substituição direto no shell.

Ferramentas disponíveis:
- {"name": "exec", "arguments": {"command": "comando_shell"}}
- {"name": "read", "arguments": {"file_path": "/caminho"}}
- {"name": "write", "arguments": {"file_path": "/caminho", "content": "conteúdo"}}
- {"name": "edit", "arguments": {"file_path": "/caminho", "oldText": "exato_velho", "newText": "novo"}}

QUANDO TERMINAR A TAREFA:
1. Use "write" no arquivo: ${relatorioFile}
2. Use "exec" com 'touch ${doneFile}'`;

    const promptContent = `${personaPrompt}
OBJETIVO: ${task.title}
DESCRIÇÃO: ${task.description}

${architectureMap}

${scopeAnalysisBlock}

REGRAS:
${combinedRules}

${engineRules}`;

    await fs.writeFile(promptFile, promptContent);
    await fs.writeFile(relatorioFile, '');
    await fs.writeFile(terminalLogFile, '');

    return {
      promptFile,
      relatorioFile,
      doneFile,
      terminalLogFile,
      promptContent,
      analysisPlan: resolvedAnalysisPlan
    };
  }

  static async executeOpenClaw(taskId, inputMessage, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 10800000) {
    return new Promise((resolve) => {
      const childArgs = [
        'agent',
        '--agent', 'programmersenior',
        '--session-id', taskId,
        '-m', inputMessage,
        '--timeout', Math.floor(timeoutMs / 1000).toString(),
      ];

      const env = { ...process.env };
      delete env.NODE_OPTIONS;

      if (model && !model.includes('deepseek-chat')) {
        env.OPENCLAW_MODEL = model;
      }

      const executionDirectory = projectPath || tasksDir;

      const child = spawn('openclaw', childArgs, {
        cwd: executionDirectory,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let streamBuffer = '';

      let isSettled = false;
      let toolExecutionStarted = false;
      let toolExecutionFinished = false;

      const settle = (result) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutTimer);
        resolve(result);
      };

      const timeoutTimer = setTimeout(() => {
        if (toolExecutionStarted && !toolExecutionFinished) {
          return;
        }

        try {
          child.kill('SIGKILL');
        } catch (_) {}

        settle({
          exitCode: null,
          success: false,
          toolFeedback: null,
          toolCall: null,
          toolResult: null,
          errorMessage: `Timeout após ${timeoutMs}ms`,
          rawOutput: `${stdout}${stderr}`
        });
      }, timeoutMs);

      const executeInterceptedTool = async () => {
        if (isSettled || toolExecutionStarted) return;

        const toolCall = this.extractToolCallFromText(streamBuffer);
        if (!toolCall) return;

        toolExecutionStarted = true;

        console.log(`\n\x1b[45m\x1b[37m [ORQUESTRADOR] Interceptou pedido: ${toolCall.name} \x1b[0m`);

        try {
          child.kill('SIGKILL');
        } catch (_) {}

        try {
          const result = await CommandExecutor.executeTool(toolCall, executionDirectory);

          let safeOutput = result.output || result.error || '';

          if (safeOutput.trim() === '') {
            safeOutput = `[AVISO DO SISTEMA: RETORNO VAZIO]
O comando executado NÃO RETORNOU NADA.
O arquivo, texto ou diretório pode NÃO EXISTIR neste caminho.
PARE IMEDIATAMENTE.
NÃO REPITA ESTE COMANDO.
Use 'ls -la' ou 'pwd' para se localizar, ou consulte a [ARQUITETURA DO PROJETO] no prompt original.`;
          } else if (safeOutput.length > 15000) {
            console.log(`\n\x1b[31m[ALERTA] Saída gigante detectada (${safeOutput.length} chars). Truncando...\x1b[0m`);
            safeOutput =
              safeOutput.substring(0, 15000) +
              `\n\n... [AVISO DO SISTEMA: O RESULTADO ERA MUITO GRANDE E FOI CORTADO. SEJA MAIS ESPECÍFICO] ...`;
          }

          const feedbackText = `\n[TOOL EXECUTION RESULT]
Tool: ${toolCall.name}
Success: ${result.success}
Output:
${safeOutput}
[END TOOL EXECUTION]
`;

          console.log(`\n\x1b[33m[SISTEMA -> JARBAS] Preparando feedback para o próximo turno:\x1b[0m`);
          console.log(`\x1b[32m${feedbackText.trim()}\x1b[0m\n`);

          toolExecutionFinished = true;

          settle({
            exitCode: 0,
            success: result.success,
            toolFeedback: feedbackText,
            toolCall,
            toolResult: result,
            errorMessage: result.success ? null : (result.error || safeOutput),
            rawOutput: `${stdout}${stderr}`
          });
        } catch (err) {
          console.log(`\n\x1b[31m[TOOL EXECUTION ERROR]\nFalha: ${err.message}\x1b[0m\n`);
          toolExecutionFinished = true;

          settle({
            exitCode: 1,
            success: false,
            toolFeedback: `\n[TOOL EXECUTION ERROR]\nFalha: ${err.message}\n[END TOOL EXECUTION]\n`,
            toolCall,
            toolResult: null,
            errorMessage: err.message,
            rawOutput: `${stdout}${stderr}`
          });
        }
      };

      const onData = (data, source) => {
        if (isSettled) return;

        const text = data.toString();

        if (source === 'stdout') {
          stdout += text;
          process.stdout.write(`\x1b[36m${text}\x1b[0m`);
        } else {
          stderr += text;
          process.stdout.write(`\x1b[33m${text}\x1b[0m`);
        }

        streamBuffer += text;

        fs.appendFile(terminalLogFile, text).catch(() => {});
        TaskExecutionService.resolveZombieLocksRealTime(text);

        executeInterceptedTool().catch((err) => {
          settle({
            exitCode: 1,
            success: false,
            toolFeedback: null,
            toolCall: null,
            toolResult: null,
            errorMessage: err.message,
            rawOutput: `${stdout}${stderr}`
          });
        });
      };

      child.stdout.on('data', (data) => onData(data, 'stdout'));
      child.stderr.on('data', (data) => onData(data, 'stderr'));

      child.on('error', (error) => {
        if (toolExecutionStarted && !toolExecutionFinished) {
          return;
        }

        settle({
          exitCode: null,
          success: false,
          toolFeedback: null,
          toolCall: null,
          toolResult: null,
          errorMessage: error.message,
          rawOutput: `${stdout}${stderr}`
        });
      });

      child.on('close', (code) => {
        if (toolExecutionStarted && !toolExecutionFinished) {
          return;
        }

        if (toolExecutionStarted && toolExecutionFinished) {
          return;
        }

        settle({
          exitCode: code,
          success: code === 0,
          toolFeedback: null,
          toolCall: null,
          toolResult: null,
          errorMessage: code === 0 ? null : `Encerrado com código ${code}`,
          rawOutput: `${stdout}${stderr}`
        });
      });
    });
  }

  static resolveZombieLocksRealTime(texto) {
    if (!texto.includes('session file locked')) return;

    const regex = /pid=\d+\s+(.+\.lock)/g;
    let match;

    while ((match = regex.exec(texto)) !== null) {
      try {
        require('fs').unlinkSync(match[1]);
      } catch (e) {}
    }
  }

  static async resolveZombieLocks(errorOutput) {
    let cleared = false;
    if (!errorOutput || !errorOutput.includes('session file locked')) return cleared;

    const regex = /pid=\d+\s+(.+\.lock)/g;
    let match;

    while ((match = regex.exec(errorOutput)) !== null) {
      try {
        await fs.unlink(match[1]);
        cleared = true;
      } catch (e) {}
    }

    return cleared;
  }

  static async verifyContract(doneFile, relatorioFile, terminalLogFile, options = {}) {
    try {
      const doneExists = await fs.access(doneFile).then(() => true).catch(() => false);
      const relatorioExists = await fs.access(relatorioFile).then(() => true).catch(() => false);

      let executionNotes = '';
      let relatorioValido = false;

      if (relatorioExists) {
        try {
          const relatorioContent = await fs.readFile(relatorioFile, 'utf8');
          if (relatorioContent.trim().length > 20) {
            executionNotes = relatorioContent.trim();
            relatorioValido = true;
          }
        } catch (_) {}
      }

      if (!options || Object.keys(options).length === 0) {
        if (doneExists || relatorioValido) {
          return {
            contractFulfilled: true,
            executionNotes: executionNotes || 'Concluído via Orquestrador'
          };
        }

        return {
          contractFulfilled: false,
          executionNotes: 'Contrato não cumprido.'
        };
      }

      const {
        taskType = 'automation',
        task = {},
        evidence = {},
        project = null,
        analysisPlan = null
      } = options;

      const resolvedAnalysisPlan = analysisPlan || this.analyzeTaskScope(task, project);

      const filesRead = Array.from(evidence.filesRead || []);
      const filesWritten = Array.from(evidence.filesWritten || []);
      const modifiedFiles = Array.from(evidence.modifiedFiles || []);
      const touchedFiles = Array.from(evidence.touchedFiles || []);
      const commandsExecuted = Array.from(evidence.commandsExecuted || []);

      const realModifiedFiles = modifiedFiles.filter((file) => file !== relatorioFile && file !== doneFile);
      const realWrittenFiles = filesWritten.filter((file) => file !== relatorioFile && file !== doneFile);
      const realTouchedFiles = Array.from(
        new Set(
          [...filesRead, ...filesWritten, ...modifiedFiles, ...touchedFiles]
            .filter((file) => file && file !== relatorioFile && file !== doneFile)
        )
      );

      const inspectionCommands = commandsExecuted.filter((cmd) =>
        /(find|grep|sed\s+-n|cat|ls|pwd|head|tail|awk|rg\b)/i.test(cmd || '')
      );

      const meaningfulCommands = commandsExecuted.filter((cmd) => {
        if (!cmd || typeof cmd !== 'string') return false;

        const normalized = cmd.trim().toLowerCase();
        if (!normalized) return false;
        if (/^touch\s+.+done/.test(normalized)) return false;
        if (normalized.includes(relatorioFile.toLowerCase()) && normalized.includes('touch')) return false;

        return true;
      });

      const fullFrontendPath = this.resolveProjectPath(project?.pastaBase, project?.frontendPath);
      const fullBackendPath = this.resolveProjectPath(project?.pastaBase, project?.backendPath);

      const modifiedInFrontend = fullFrontendPath
        ? realModifiedFiles.filter((file) => this.isPathInside(file, fullFrontendPath))
        : [];

      const modifiedInBackend = fullBackendPath
        ? realModifiedFiles.filter((file) => this.isPathInside(file, fullBackendPath))
        : [];

      const touchedInFrontend = fullFrontendPath
        ? realTouchedFiles.filter((file) => this.isPathInside(file, fullFrontendPath))
        : [];

      const touchedInBackend = fullBackendPath
        ? realTouchedFiles.filter((file) => this.isPathInside(file, fullBackendPath))
        : [];

      const reportRequired =
        this.requiresReport(task) ||
        taskType === 'analysis' ||
        taskType === 'development';

      if (taskType === 'analysis') {
        if (!relatorioValido) {
          return {
            contractFulfilled: false,
            executionNotes: 'Aguardando relatório válido.',
            feedbackToAgent:
              '[VALIDAÇÃO] Esta é uma tarefa de análise/documentação. Gere um relatório final consistente no arquivo de relatório antes de concluir.'
          };
        }

        if (!doneExists) {
          return {
            contractFulfilled: false,
            executionNotes: 'Aguardando arquivo .done.',
            feedbackToAgent:
              '[VALIDAÇÃO] Gere o relatório e finalize criando o arquivo .done obrigatório.'
          };
        }

        if (filesRead.length === 0 && inspectionCommands.length === 0) {
          return {
            contractFulfilled: false,
            executionNotes: 'Sem evidência de inspeção.',
            feedbackToAgent:
              '[VALIDAÇÃO] Você gerou saída final, mas ainda não há evidência de inspeção/análise. Leia arquivos ou execute comandos de inspeção antes de concluir.'
          };
        }

        return {
          contractFulfilled: true,
          executionNotes: executionNotes || 'Tarefa de análise concluída.'
        };
      }

      if (taskType === 'development') {
        if (!relatorioValido) {
          return {
            contractFulfilled: false,
            executionNotes: 'Aguardando relatório válido.',
            feedbackToAgent:
              '[VALIDAÇÃO] Esta é uma tarefa de desenvolvimento. Gere um relatório final válido no arquivo de relatório.'
          };
        }

        if (!doneExists) {
          return {
            contractFulfilled: false,
            executionNotes: 'Aguardando arquivo .done.',
            feedbackToAgent:
              '[VALIDAÇÃO] Após implementar as alterações, crie o arquivo .done obrigatório.'
          };
        }

        if (realModifiedFiles.length === 0) {
          return {
            contractFulfilled: false,
            executionNotes: 'Nenhuma alteração real detectada.',
            feedbackToAgent:
              '[VALIDAÇÃO] Relatório e .done não substituem implementação. Nenhum arquivo real do projeto foi modificado ainda. Volte, localize os arquivos corretos e faça a alteração necessária antes de concluir.'
          };
        }

        for (const layer of resolvedAnalysisPlan.requiredModifiedLayers || []) {
          if (layer === 'frontend' && fullFrontendPath && modifiedInFrontend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'Pré-análise exige alteração no frontend, mas nenhuma foi detectada.',
              feedbackToAgent:
                `[VALIDAÇÃO] A pré-análise desta tarefa exige alteração REAL no frontend. Você ainda não modificou arquivos em ${project.frontendPath}. Revise o frontend, altere os formulários/telas necessários, atualize o relatório e recrie o .done.`
            };
          }

          if (layer === 'backend' && fullBackendPath && modifiedInBackend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'Pré-análise exige alteração no backend, mas nenhuma foi detectada.',
              feedbackToAgent:
                `[VALIDAÇÃO] A pré-análise desta tarefa exige alteração REAL no backend. Você ainda não modificou arquivos em ${project.backendPath}. Revise o backend, implemente a alteração, atualize o relatório e recrie o .done.`
            };
          }
        }

        for (const layer of resolvedAnalysisPlan.expectedLayers || []) {
          if (resolvedAnalysisPlan.requiredModifiedLayers?.includes(layer)) {
            continue;
          }

          if (layer === 'frontend' && fullFrontendPath && touchedInFrontend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'A pré-análise esperava revisão do frontend, mas não há evidência disso.',
              feedbackToAgent:
                `[VALIDAÇÃO] A pré-análise indicou impacto potencial no frontend. Ainda não há evidência de inspeção em ${project.frontendPath}. Revise essa camada antes de concluir.`
            };
          }

          if (layer === 'backend' && fullBackendPath && touchedInBackend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'A pré-análise esperava revisão do backend, mas não há evidência disso.',
              feedbackToAgent:
                `[VALIDAÇÃO] A pré-análise indicou impacto potencial no backend. Ainda não há evidência de inspeção em ${project.backendPath}. Revise essa camada antes de concluir.`
            };
          }
        }

        return {
          contractFulfilled: true,
          executionNotes: executionNotes || 'Tarefa de desenvolvimento concluída.'
        };
      }

      if (reportRequired && !relatorioValido) {
        return {
          contractFulfilled: false,
          executionNotes: 'Aguardando relatório válido.',
          feedbackToAgent:
            '[VALIDAÇÃO] Esta tarefa exige relatório final. Escreva o resultado no arquivo de relatório antes de concluir.'
        };
      }

      if (!doneExists) {
        return {
          contractFulfilled: false,
          executionNotes: 'Aguardando arquivo .done.',
          feedbackToAgent:
            '[VALIDAÇÃO] Finalize a tarefa criando o arquivo .done obrigatório.'
        };
      }

      const usefulExecution =
        realModifiedFiles.length > 0 ||
        realWrittenFiles.length > 0 ||
        filesRead.length > 0 ||
        meaningfulCommands.length > 0;

      if (!usefulExecution) {
        return {
          contractFulfilled: false,
          executionNotes: 'Sem evidência de execução útil.',
          feedbackToAgent:
            '[VALIDAÇÃO] Ainda não há evidência de execução útil. Execute as ações necessárias antes de concluir.'
        };
      }

      return {
        contractFulfilled: true,
        executionNotes: executionNotes || 'Tarefa de automação concluída.'
      };
    } catch (e) {
      return {
        contractFulfilled: false,
        executionNotes: e.message
      };
    }
  }

  static async runBuildValidationIfNeeded(project, evidence) {
    try {
      if (!project) {
        console.log('[QA] ⚠️ Tarefa sem projeto associado. Pulando validação de build.');
        return { passed: true, message: 'Sem projeto associado.' };
      }

      const modifiedFiles = Array.from(evidence.modifiedFiles || []);
      let buildErrors = '';
      let tentativasBuild = 0;

      const fullFrontendPath = this.resolveProjectPath(project.pastaBase, project.frontendPath);
      const fullBackendPath = this.resolveProjectPath(project.pastaBase, project.backendPath);

      const houveAlteracaoFrontend =
        fullFrontendPath &&
        modifiedFiles.some((file) => this.isPathInside(file, fullFrontendPath));

      const houveAlteracaoBackend =
        fullBackendPath &&
        modifiedFiles.some((file) => this.isPathInside(file, fullBackendPath));

      if (houveAlteracaoFrontend) {
        tentativasBuild++;
        const cmd = project.frontendBuildCmd || 'npx -p typescript tsc --noEmit';
        console.log(`[QA] 🎨 Alterações detectadas em ${project.frontendPath}. Rodando: ${cmd}`);

        try {
          execSync(cmd, {
            cwd: fullFrontendPath,
            stdio: 'pipe',
            encoding: 'utf8',
            timeout: 600000,
            maxBuffer: 20 * 1024 * 1024
          });
        } catch (err) {
          buildErrors += `[ERRO NO FRONTEND]\n${String(err.stdout || '')}\n${String(err.stderr || '')}\n${err.message}\n\n`;
        }
      }

      if (houveAlteracaoBackend) {
        tentativasBuild++;

        if (project.backendBuildCmd) {
          console.log(`[QA] ⚙️ Alterações detectadas em ${project.backendPath}. Rodando: ${project.backendBuildCmd}`);

          try {
            execSync(project.backendBuildCmd, {
              cwd: fullBackendPath,
              stdio: 'pipe',
              encoding: 'utf8',
              timeout: 600000,
              maxBuffer: 20 * 1024 * 1024
            });
          } catch (err) {
            buildErrors += `[ERRO NO BACKEND]\n${String(err.stdout || '')}\n${String(err.stderr || '')}\n${err.message}\n\n`;
          }
        } else {
          console.log(`[QA] ⚠️ Alterações no backend detectadas, mas nenhum 'Comando de Build' configurado no painel. Pulando validação do backend.`);
        }
      }

      if (tentativasBuild === 0) {
        console.log('[QA] ⚠️ Nenhuma alteração estrutural detectada nos paths configurados. Pulando build.');
      }

      if (buildErrors) {
        return {
          passed: false,
          message: buildErrors.substring(0, 3000)
        };
      }

      return {
        passed: true,
        message: tentativasBuild > 0 ? 'Build aprovado.' : 'Nenhum build necessário.'
      };
    } catch (error) {
      return {
        passed: false,
        message: `Falha inesperada na validação de build: ${error.message}`
      };
    }
  }

  static async cleanupFiles(files) {
    if (!files || !files.promptFile) return;

    try {
      const baseDir = path.dirname(files.promptFile);
      const processedDir = path.join(baseDir, 'processed');
      await fs.mkdir(processedDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filesToMove = [files.promptFile, files.relatorioFile, files.doneFile, files.terminalLogFile];

      for (const file of filesToMove) {
        try {
          await fs.access(file);

          const fileName = path.basename(file);
          const ext = path.extname(fileName);
          const nameWithoutExt = path.basename(fileName, ext);
          const newFileName = `${nameWithoutExt}_${timestamp}${ext}`;

          await fs.rename(file, path.join(processedDir, newFileName));
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error(`[Aviso] Falha ao mover ${file}:`, error.message);
          }
        }
      }

      console.log('📂 Limpeza concluída.');
    } catch (error) {
      console.error(`❌ Erro fatal ao tentar mover arquivos: ${error.message}`);
    }
  }

  static async executeTask(task, userId, config) {
    const { TASKS_DIR, TASK_TIMEOUT_MS = 300000 } = config;

    let executionLog = null;
    let files = null;

    try {
      executionLog = await this.createExecutionLog(task, userId, task.model);

      const project = task.projectId
        ? await prisma.project.findUnique({ where: { id: task.projectId } })
        : null;

      const analysisPlan = this.analyzeTaskScope(task, project);
      const taskType = analysisPlan.taskType;

      if (config.DEBUG_TASK_ANALYSIS) {
        this.printDebugBlock('PRE_ANALISE', {
          taskId: task.id,
          title: task.title,
          description: task.description,
          taskType: analysisPlan.taskType,
          expectedLayers: analysisPlan.expectedLayers,
          requiredModifiedLayers: analysisPlan.requiredModifiedLayers,
          mandatoryChecks: analysisPlan.mandatoryChecks,
          definitionOfDone: analysisPlan.definitionOfDone,
          finalizationInstructions: analysisPlan.finalizationInstructions,
          risks: analysisPlan.risks,
          project: project ? {
            id: project.id,
            name: project.name,
            pastaBase: project.pastaBase,
            frontendPath: project.frontendPath,
            backendPath: project.backendPath,
            frontendBuildCmd: project.frontendBuildCmd,
            backendBuildCmd: project.backendBuildCmd
          } : null
        });
      }

      console.log(`[PRÉ-ANÁLISE] Tipo: ${taskType}`);
      console.log(`[PRÉ-ANÁLISE] Camadas esperadas: ${this.formatInlineList(analysisPlan.expectedLayers, 'nenhuma')}`);
      console.log(`[PRÉ-ANÁLISE] Camadas com alteração obrigatória: ${this.formatInlineList(analysisPlan.requiredModifiedLayers, 'nenhuma obrigatória')}`);

      files = await this.prepareTaskFiles(task, TASKS_DIR, project, analysisPlan);

      if (config.DEBUG_TASK_PROMPT) {
        this.printDebugBlock('TASK_FILES', {
          TASKS_DIR,
          promptFile: files.promptFile,
          relatorioFile: files.relatorioFile,
          doneFile: files.doneFile,
          terminalLogFile: files.terminalLogFile
        });

        this.printDebugBlock('PROMPT_GERADO', files.promptContent);
      }

      const evidence = {
        toolsUsed: [],
        filesRead: new Set(),
        filesWritten: new Set(),
        modifiedFiles: new Set(),
        touchedFiles: new Set(),
        commandsExecuted: []
      };

      let contractResult = { contractFulfilled: false, executionNotes: 'Contrato não cumprido.' };
      let turnos = 0;
      const MAX_TURNOS = 70;

      let currentInput = files.promptContent;

      console.log(`\n🤖 [INICIANDO LOOP RE-ACT] Tarefa: ${task.id}`);

      try { await fs.unlink(files.doneFile); } catch (e) {}
      try { await fs.unlink(files.relatorioFile); } catch (e) {}

      let turnosSemProgresso = 0;
      const MAX_TURNOS_SEM_PROGRESSO = 5;

      while (!contractResult.contractFulfilled && turnos < MAX_TURNOS) {
        turnos++;
        console.log(`\n\x1b[44m\x1b[37m 🔄 --- INICIANDO TURNO ${turnos}/${MAX_TURNOS} --- \x1b[0m`);

        const executionResult = await this.executeOpenClaw(
          task.id,
          currentInput,
          task.model,
          TASKS_DIR,
          files.terminalLogFile,
          project?.pastaBase || null,
          TASK_TIMEOUT_MS
        );

        if (!executionResult.toolFeedback && executionResult.rawOutput) {
          console.log('\n[RAW OUTPUT DO AGENTE]');
          console.log(executionResult.rawOutput.substring(0, 3000));
          console.log('[FIM RAW OUTPUT]\n');
        }

        if (executionResult.toolResult) {
          if (executionResult.toolCall?.name) {
            evidence.toolsUsed.push(executionResult.toolCall.name);
          }

          for (const file of executionResult.toolResult.filesRead || []) {
            evidence.filesRead.add(file);
          }

          for (const file of executionResult.toolResult.filesWritten || []) {
            evidence.filesWritten.add(file);
          }

          for (const file of executionResult.toolResult.modifiedFiles || []) {
            evidence.modifiedFiles.add(file);
          }

          for (const file of executionResult.toolResult.touchedFiles || []) {
            evidence.touchedFiles.add(file);
          }

          if (executionResult.toolResult.commandExecuted) {
            evidence.commandsExecuted.push(executionResult.toolResult.commandExecuted);
          }
        }

        contractResult = await this.verifyContract(
          files.doneFile,
          files.relatorioFile,
          files.terminalLogFile,
          {
            taskType,
            task,
            evidence,
            project,
            analysisPlan
          }
        );

        if (config.DEBUG_TASK_CONTRACT) {
          const doneExists = await this.fileExists(files.doneFile);
          const relatorioExists = await this.fileExists(files.relatorioFile);

          this.printDebugBlock(`CONTRATO_TURNO_${turnos}`, {
            contractFulfilled: contractResult.contractFulfilled,
            executionNotes: contractResult.executionNotes,
            feedbackToAgent: contractResult.feedbackToAgent || null,

            paths: {
              TASKS_DIR,
              promptFile: files.promptFile,
              relatorioFile: files.relatorioFile,
              doneFile: files.doneFile,
              terminalLogFile: files.terminalLogFile
            },

            existsOnDisk: {
              relatorioExists,
              doneExists
            },

            evidenceSummary: {
              toolsUsed: evidence.toolsUsed,
              filesRead: Array.from(evidence.filesRead),
              filesWritten: Array.from(evidence.filesWritten),
              modifiedFiles: Array.from(evidence.modifiedFiles),
              touchedFiles: Array.from(evidence.touchedFiles),
              commandsExecuted: evidence.commandsExecuted
            }
          });
        }

        if (contractResult.contractFulfilled) {
          if (taskType === 'development') {
            console.log(`\x1b[43m\x1b[30m ⚙️ FASE DE BUILD AUTOMATIZADO INICIADA NO TURNO ${turnos} \x1b[0m`);

            const qaResult = await this.runBuildValidationIfNeeded(project, evidence);

            if (!qaResult.passed) {
              console.log(`\x1b[41m\x1b[37m ❌ BUILD FALHOU! DEVOLVENDO O ERRO PARA A IA... \x1b[0m`);

              try { await fs.unlink(files.doneFile); } catch (e) {}

              currentInput = `[ERRO CRÍTICO DE COMPILAÇÃO - FASE DE QA]
Você tentou finalizar a tarefa, mas quebrou a compilação do projeto.
Veja os erros:
${qaResult.message}
Conserte o código com 'edit' ou 'exec' antes de finalizar novamente.
Depois gere o relatório final e recrie o arquivo .done.`;

              contractResult = { contractFulfilled: false, executionNotes: qaResult.message };
              turnosSemProgresso = 0;
              continue;
            }

            console.log(`\x1b[42m\x1b[30m ✅ QA APROVADO! CONTRATO CUMPRIDO NO TURNO ${turnos}! \x1b[0m`);
          }

          break;
        }

        const houveProgresso =
          !!executionResult.toolFeedback || contractResult.contractFulfilled;

        if (executionResult.toolFeedback) {
          currentInput = executionResult.toolFeedback;

          if (contractResult.feedbackToAgent) {
            currentInput += `\n${contractResult.feedbackToAgent}\n`;
          }
        } else if (executionResult.rawOutput && executionResult.rawOutput.trim()) {
          currentInput =
            contractResult.feedbackToAgent ||
            `[ERRO DE PROTOCOLO]
Você respondeu sem usar uma ferramenta válida em JSON estrito.
Sua resposta anterior foi inválida para este sistema.

Regras obrigatórias:
- Emita APENAS um JSON válido de ferramenta por turno.
- Não responda em texto livre.
- Use uma destas ferramentas: exec, read, write, edit.

Se precisar procurar arquivos, use primeiro:
{"name":"exec","arguments":{"command":"find ..."}}`;
        } else if (!executionResult.success) {
          currentInput = `[ERRO DE EXECUÇÃO]
A execução do agente falhou.
Motivo: ${executionResult.errorMessage || 'Erro desconhecido'}
Tente se recuperar sem repetir comandos inúteis.`;
        } else {
          currentInput =
            contractResult.feedbackToAgent ||
            `[ERRO DE PROTOCOLO]
Nenhuma ferramenta válida foi emitida.
Continue usando SOMENTE JSON estrito com uma única ferramenta por turno.`;
        }

        if (houveProgresso) {
          turnosSemProgresso = 0;
        } else {
          turnosSemProgresso++;
          console.log(`⚠️ Turno sem progresso: ${turnosSemProgresso}/${MAX_TURNOS_SEM_PROGRESSO}`);
        }

        if (turnosSemProgresso >= MAX_TURNOS_SEM_PROGRESSO) {
          contractResult = {
            contractFulfilled: false,
            executionNotes: `Agente não produziu tool call nem saída útil após ${MAX_TURNOS_SEM_PROGRESSO} turnos consecutivos.`
          };
          break;
        }
      }


      if (config.DEBUG_TASK_CONTRACT) {
        const doneExists = await this.fileExists(files.doneFile);
        const relatorioExists = await this.fileExists(files.relatorioFile);

        this.printDebugBlock('CONTRATO_FINAL', {
          finalTurn: turnos,
          contractFulfilled: contractResult.contractFulfilled,
          executionNotes: contractResult.executionNotes,
          feedbackToAgent: contractResult.feedbackToAgent || null,
          existsOnDisk: {
            relatorioFile: files.relatorioFile,
            relatorioExists,
            doneFile: files.doneFile,
            doneExists
          },
          evidenceSummary: {
            toolsUsed: evidence.toolsUsed,
            filesRead: Array.from(evidence.filesRead),
            filesWritten: Array.from(evidence.filesWritten),
            modifiedFiles: Array.from(evidence.modifiedFiles),
            touchedFiles: Array.from(evidence.touchedFiles),
            commandsExecuted: evidence.commandsExecuted
          }
        });
      }

      const finalResult = {
        success: contractResult.contractFulfilled,
        exitCode: contractResult.contractFulfilled ? 0 : 1,
        errorMessage: contractResult.contractFulfilled
          ? null
          : (contractResult.executionNotes || `Falha: Limite de ${MAX_TURNOS} turnos atingido sem conclusão.`),
        executionNotes: contractResult.executionNotes
      };

      await this.finishExecutionLog(executionLog.id, finalResult);

      return {
        ...finalResult,
        taskId: task.id,
        executionLogId: executionLog.id
      };
    } catch (error) {
      if (executionLog) {
        await this.finishExecutionLog(executionLog.id, {
          success: false,
          errorMessage: error.message
        });
      }

      throw error;
    }
  }
}

module.exports = TaskExecutionService;


