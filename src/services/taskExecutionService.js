// taskExecutionService.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const CommandExecutor = require('./commandExecutor');
const prisma = new PrismaClient();
const { Logger } = require('../utils/logger'); 
const { log } = require('console');

class TaskExecutionService {
  
  static async createExecutionLog(task, userId, model) {
    try {
      const executionLog = await prisma.taskExecutionLog.create({
        data: {
          taskId: task.id,
          userId: userId,
          model: model || task.model || 'deepseek/deepseek-chat',
          startedAt: new Date(),
          success: false
        }
      });
      log(`📝 Log de execução criado para tarefa ${task.id}`);
      return executionLog;
    } catch (error) {
      log(`❌ Erro ao criar log de execução: ${error.message}`);
      throw error;
    }
  }

  static async finishExecutionLog(logId, result) {
    try {
      const logEntry = await prisma.taskExecutionLog.findUnique({ where: { id: logId } });
      if (!logEntry) throw new Error(`Log não encontrado`);

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

  static async prepareTaskFiles(task, tasksDir) {
    const taskId = task.id;
    const promptFile = path.join(tasksDir, `prompt-${taskId}.txt`);
    const relatorioFile = path.join(tasksDir, `relatorio-${taskId}.txt`);
    const doneFile = path.join(tasksDir, `done-${taskId}.done`);
    const terminalLogFile = path.join(tasksDir, `terminal-${taskId}.log`);

    // Busca o projeto com seu tipo (se existir)
    let project = null;
    try {
      project = await prisma.project.findUnique({
        where: { id: task.projectId },
        include: { projectType: true }
      });
    } catch (e) {
      console.error(`Erro ao buscar projeto: ${e.message}`);
    }

    // Persona padrão caso não haja projectType
    let personaPrompt = "Você é o Agente Técnico Jarbas.";
    let baseRules = "";

    if (project?.projectType) {
      personaPrompt = project.projectType.personaPrompt || personaPrompt;
      baseRules = project.projectType.baseRules || "";
    }

    // Regras específicas do projeto (campo regras)
    const projectSpecificRules = project?.regras ? project.regras : "Nenhuma regra específica definida.";

    // Combina regras: baseRules do tipo + regras específicas do projeto
    const combinedRules = [baseRules, projectSpecificRules]
      .filter(r => r && r.trim() !== "")
      .join("\n\n");

    // Engine rules (regras mecânicas do sistema - hardcoded)
    const engineRules = `[REGRA DE OURO - PROIBIDO ADIVINHAR CAMINHOS]
1. Você NÃO PODE adivinhar nomes de arquivos ou caminhos. NUNCA use "read" ou "edit" sem antes confirmar o caminho exato.
2. OBRIGATÓRIO: Seu primeiro comando deve SEMPRE usar "exec" para mapear o projeto.
   -> IMPORTANTE: Em comandos find/grep, IGNORE pastas como 'node_modules', 'dist', 'build' e '.git'.
   -> Exemplo de busca segura: {"name": "exec", "arguments": {"command": "grep -rn --exclude-dir={node_modules,dist,.git} 'Criar Nova Tarefa' ."}}
3. Só use "edit" após receber o retorno da busca com o caminho real.

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

    // Montagem final do prompt
    const promptContent = `${personaPrompt}
OBJETIVO: ${task.title}
DESCRIÇÃO: ${task.description}

REGRAS: ${combinedRules}

${engineRules}`;

    await fs.writeFile(promptFile, promptContent);
    await fs.writeFile(relatorioFile, '');
    await fs.writeFile(terminalLogFile, '');

    return { promptFile, relatorioFile, doneFile, terminalLogFile, promptContent };
  }

  static async executeOpenClaw(taskId, inputMessage, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 10800000) {
    return new Promise((resolve, reject) => {
      const childArgs = [
        'agent',
        '--agent', 'ArquitetoSenior',
        '--session-id', taskId,
        '-m', inputMessage,
        '--timeout', Math.floor(timeoutMs / 1000).toString(),
      ];

      const env = { ...process.env };
      delete env.NODE_OPTIONS;
      if (model && !model.includes('deepseek-chat')) env.OPENCLAW_MODEL = model;

      const executionDirectory = projectPath || tasksDir;
      
      const child = spawn("openclaw", childArgs, {
        cwd: executionDirectory,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'] // stdin ignorado, não vamos mais escrever nele!
      });

      let stdout = '';
      let stderr = '';
      let streamBuffer = ''; 
      let isResolving = false; // Evita resolver a promise duas vezes

      const timeoutTimer = setTimeout(() => {
        if (!isResolving) {
          isResolving = true;
          child.kill('SIGKILL');
          resolve({ exitCode: null, success: false, errorMessage: `Timeout` });
        }
      }, timeoutMs);

      const extractValidJSON = (text) => {
        const startIndex = text.indexOf('{"name"');
        if (startIndex === -1) return null;
        let depth = 0, inString = false, escape = false;
        for (let i = startIndex; i < text.length; i++) {
          const char = text[i];
          if (escape) { escape = false; continue; }
          if (char === '\\') { escape = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
              depth--;
              if (depth === 0) {
                const jsonStr = text.substring(startIndex, i + 1);
                try { return { jsonStr, parsed: JSON.parse(jsonStr) }; } catch (e) { return null; }
              }
            }
          }
        }
        return null;
      };

      const processReActBuffer = async () => {
        if (isResolving) return;
        
        const extracted = extractValidJSON(streamBuffer);

        if (extracted) {
          isResolving = true; // Bloqueia outros processamentos
          clearTimeout(timeoutTimer);
          
          try {
            const toolCall = extracted.parsed;
            console.log(`\n\x1b[45m\x1b[37m [ORQUESTADOR] Interceptou pedido: ${toolCall.name} \x1b[0m`);
            
            // Mata o processo filho imediatamente, pois já pegamos a ferramenta que queríamos
            child.kill('SIGKILL');
            

            // Executa a ferramenta no ambiente Node
            const result = await CommandExecutor.executeTool(toolCall, executionDirectory);
            
            // ESCUDO ANTI-E2BIG: Limita a saída para não estourar o terminal nem a memória da IA
            let safeOutput = result.output || result.error || "Executado sem retorno visual.";
            if (safeOutput.length > 15000) {
                console.log(`\n\x1b[31m[ALERTA] Saída gigante detectada (${safeOutput.length} chars). Truncando para 15000...\x1b[0m`);
                safeOutput = safeOutput.substring(0, 15000) + "\n\n... [AVISO DO SISTEMA: O RESULTADO ERA MUITO GRANDE E FOI CORTADO. SEJA MAIS ESPECÍFICO NA BUSCA OU IGNORE PASTAS COMPILADAS] ...";
            }

            const feedbackText = `\n[TOOL EXECUTION RESULT]\nTool: ${toolCall.name}\nSuccess: ${result.success}\nOutput:\n${safeOutput}\n[END TOOL EXECUTION]\n`;

            console.log(`\n\x1b[33m[SISTEMA -> JARBAS] Preparando feedback para o próximo turno:\x1b[0m`);
            console.log(`\x1b[32m${feedbackText.trim()}\x1b[0m\n`); 
            
            // Resolve a promise devolvendo o feedback para o laço principal
            resolve({ 
              exitCode: 0, 
              success: true, 
              toolFeedback: feedbackText,
              errorMessage: null 
            });
            
          } catch (err) {
            resolve({ 
              exitCode: 1, 
              success: false, 
              toolFeedback: `\n[TOOL EXECUTION ERROR]\nFalha: ${err.message}\n[END TOOL EXECUTION]\n`,
              errorMessage: err.message 
            });
          }
        }
      };

      child.stdout.on('data', async (data) => {
        if (isResolving) return;
        const text = data.toString();
        stdout += text; streamBuffer += text;
        process.stdout.write(`\x1b[36m${text}\x1b[0m`); 
        fs.appendFile(terminalLogFile, text).catch(() => {});
        TaskExecutionService.resolveZombieLocksRealTime(text);
        await processReActBuffer();
      });

      child.stderr.on('data', async (data) => {
        if (isResolving) return;
        const text = data.toString();
        stderr += text; streamBuffer += text; 
        process.stdout.write(`\x1b[33m${text}\x1b[0m`); 
        fs.appendFile(terminalLogFile, text).catch(() => {});
        TaskExecutionService.resolveZombieLocksRealTime(text);
        await processReActBuffer();
      });

      child.on('error', (error) => {
        if (!isResolving) {
          isResolving = true;
          clearTimeout(timeoutTimer);
          reject({ exitCode: null, success: false, errorMessage: error.message });
        }
      });

      child.on('close', (code) => {
        if (!isResolving) {
          isResolving = true;
          clearTimeout(timeoutTimer);
          resolve({ 
            exitCode: code, 
            success: code === 0, 
            toolFeedback: null, // O processo fechou naturalmente sem pedir ferramentas
            errorMessage: code !== 0 ? `Encerrado com código ${code}` : null, 
          });
        }
      });
    });
  }

  static resolveZombieLocksRealTime(texto) {
    if (!texto.includes('session file locked')) return;
    const regex = /pid=\d+\s+(.+\.lock)/g;
    let match;
    while ((match = regex.exec(texto)) !== null) {
      try { require('fs').unlinkSync(match[1]); } catch (e) {}
    }
  }

  static async resolveZombieLocks(errorOutput) {
    let cleared = false;
    if (!errorOutput || !errorOutput.includes('session file locked')) return cleared;
    const regex = /pid=\d+\s+(.+\.lock)/g;
    let match;
    while ((match = regex.exec(errorOutput)) !== null) {
      try { await fs.unlink(match[1]); cleared = true; } catch (e) {}
    }
    return cleared;
  }

  static async verifyContract(doneFile, relatorioFile, terminalLogFile) {
    try {
      const doneExists = await fs.access(doneFile).then(() => true).catch(() => false);
      let executionNotes = ''; let relatorioValido = false;

      try {
        const relatorioContent = await fs.readFile(relatorioFile, 'utf8');
        if (relatorioContent.trim().length > 10) { executionNotes = relatorioContent; relatorioValido = true; }
      } catch (e) {}

      if (doneExists || relatorioValido) {
        if (!doneExists) await fs.writeFile(doneFile, ''); 
        return { contractFulfilled: true, executionNotes: executionNotes || 'Concluído via Orquestrador' };
      }
      return { contractFulfilled: false, executionNotes: 'Contrato não cumprido.' };
    } catch (e) {
      return { contractFulfilled: false, executionNotes: e.message };
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
          if (error.code !== 'ENOENT') console.error(`[Aviso] Falha ao mover ${file}:`, error.message);
        }
      }
      console.log(`📂 Limpeza concluída.`);
    } catch (error) {
      console.error(`❌ Erro fatal ao tentar mover arquivos: ${error.message}`);
    }
  }

  static async executeTask(task, userId, config) {
    const { TASKS_DIR, TASK_TIMEOUT_MS = 300000 } = config;
    let executionLog = null; let files = null;

    try {
      executionLog = await this.createExecutionLog(task, userId, task.model);
      files = await this.prepareTaskFiles(task, TASKS_DIR);
      const project = await prisma.project.findUnique({ where: { id: task.projectId } });

      let contractResult = { contractFulfilled: false };
      let turnos = 0;
      const MAX_TURNOS = 70; 
      let hasPassedQA = false; // NOVA VARIÁVEL: Controle da fase de revisão
      
      let currentInput = files.promptContent;

      console.log(`\n🤖 [INICIANDO LOOP RE-ACT] Tarefa: ${task.id}`);

      while (!contractResult.contractFulfilled && turnos < MAX_TURNOS) {
        turnos++;
        console.log(`\n\x1b[44m\x1b[37m 🔄 --- INICIANDO TURNO ${turnos}/${MAX_TURNOS} --- \x1b[0m`);

        let executionResult = await this.executeOpenClaw(
          task.id, 
          currentInput, 
          task.model, 
          TASKS_DIR, 
          files.terminalLogFile, 
          project?.pastaBase || null, 
          TASK_TIMEOUT_MS
        );

        contractResult = await this.verifyContract(files.doneFile, files.relatorioFile, files.terminalLogFile);
        
        // ==========================================
        // FASE DE INTERCEPTAÇÃO DE QA (AUTO-REVISÃO)
        // ==========================================
        if (contractResult.contractFulfilled) {
          if (!hasPassedQA) {
            console.log(`\x1b[43m\x1b[30m 🧐 FASE DE AUTO-REVISÃO INICIADA NO TURNO ${turnos} \x1b[0m`);
            
            // Apaga o arquivo .done secretamente
            try { await fs.unlink(files.doneFile); } catch (e) {}
            // NOVO: Esvazia o relatório para invalidar o contrato atual!
            try { await fs.writeFile(files.relatorioFile, ''); } catch (e) {}
            
            contractResult.contractFulfilled = false; 
            hasPassedQA = true; 
            
            currentInput = `[FASE DE AUTO-REVISÃO OBRIGATÓRIA]
Você acabou de sinalizar que a tarefa está pronta. AGORA PARE E MUDE SUA POSTURA. 
Atue como um Revisor de Código Sênior rigoroso. Leia atentamente as alterações que você acabou de fazer.

Verifique especificamente:
1. Você alterou O ARQUIVO CORRETO que a tarefa pediu?
2. Você chamou alguma função nova mas ESQUECEU de declará-la?
3. Em arquivos React/JSX, você esqueceu as chaves '{}' ao redor das variáveis?

Se você identificar QUALQUER erro, ou se perceber que NÃO FEZ a alteração, use 'edit' ou 'exec' para consertar agora mesmo.
Se você revisar e tiver CERTEZA ABSOLUTA que está perfeito, você DEVE gerar um NOVO relatório com a ferramenta 'write' e usar 'exec' com 'touch ${files.doneFile}' para aprovar a revisão final.`;
            
            continue; 
          } else {
            console.log(`\x1b[42m\x1b[30m 🎯 CONTRATO CUMPRIDO E REVISADO NO TURNO ${turnos}! \x1b[0m`);
            break;
          }
        }
      }

      const finalResult = {
        success: contractResult.contractFulfilled,
        exitCode: 0,
        errorMessage: contractResult.contractFulfilled ? null : `Falha: Limite de ${MAX_TURNOS} turnos atingido sem conclusão.`,
        executionNotes: contractResult.executionNotes
      };

      await this.finishExecutionLog(executionLog.id, finalResult);
      await this.cleanupFiles(files); 
      return { ...finalResult, taskId: task.id, executionLogId: executionLog.id };
    } catch (error) {
      if (executionLog) await this.finishExecutionLog(executionLog.id, { success: false, errorMessage: error.message });
      throw error;
    }
  }
}

module.exports = TaskExecutionService;