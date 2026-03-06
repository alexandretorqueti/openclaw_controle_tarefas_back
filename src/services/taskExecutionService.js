// taskExecutionService.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { Logger } = require('../utils/logger');
const { log } = require('console');
const prisma = new PrismaClient();
const { logger } = require('../../aux/logger');

class TaskExecutionService {
  /**
   * Cria um log de execução no banco de dados
   * @param {Object} task - Objeto da tarefa
   * @param {string} userId - ID do usuário responsável
   * @param {string} model - Modelo de IA a ser utilizado
   * @returns {Promise<Object>} Log criado
   */
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
      log(`📝 Log de execução criado para tarefa ${task.id} (Log ID: ${executionLog.id})`);
      await Logger.createLog({
        level: 'INFO',
        endpoint: 'TaskExecutionService',
        method: 'createExecutionLog',
        message: `Log de execução criado para tarefa ${task.id}`,
        userId: userId
      });

      return executionLog;
    } catch (error) {
      log(`❌ Erro ao criar log de execução: ${error.message}`);
      await Logger.createLog({
        level: 'ERROR',
        endpoint: 'TaskExecutionService',
        method: 'createExecutionLog',
        message: `Erro ao criar log de execução: ${error.message}`,
        errorType: error.constructor.name,
        stackTrace: error.stack
      });
      throw error;
    }
  }

  /**
   * Finaliza um log de execução
   * @param {string} logId - ID do log
   * @param {Object} result - Resultado da execução
   * @returns {Promise<Object>} Log atualizado
   */
  static async finishExecutionLog(logId, result) {
    try {
      const finishedAt = new Date();
      
      // Busca o log para calcular duração
      const log = await prisma.taskExecutionLog.findUnique({
        where: { id: logId }
      });

      if (!log) {
        throw new Error(`Log de execução ${logId} não encontrado`);
      }

      const durationMs = finishedAt - log.startedAt;

      const updatedLog = await prisma.taskExecutionLog.update({
        where: { id: logId },
        data: {
          finishedAt,
          durationMs,
          success: result.success || false,
          exitCode: result.exitCode,
          errorMessage: result.errorMessage,
          executionNotes: result.executionNotes
        }
      });

      // Cria log no sistema de logs
      await Logger.createLog({
        level: result.success ? 'INFO' : 'ERROR',
        endpoint: 'TaskExecutionService',
        method: 'finishExecutionLog',
        message: `Execução da tarefa ${log.taskId} ${result.success ? 'concluída com sucesso' : 'falhou'}`,
        userId: log.userId,
        responseTime: durationMs
      });

      return updatedLog;
    } catch (error) {
      await Logger.createLog({
        level: 'ERROR',
        endpoint: 'TaskExecutionService',
        method: 'finishExecutionLog',
        message: `Erro ao finalizar log de execução: ${error.message}`,
        errorType: error.constructor.name,
        stackTrace: error.stack
      });
      throw error;
    }
  }

  /**
   * Prepara arquivos para execução da tarefa
   * @param {Object} task - Objeto da tarefa
   * @param {string} tasksDir - Diretório de tarefas
   * @returns {Promise<Object>} Informações dos arquivos criados
   */
  static async prepareTaskFiles(task, tasksDir) {
    const taskId = task.id;
    const promptFile = path.join(tasksDir, `prompt-${taskId}.txt`);
    const relatorioFile = path.join(tasksDir, `relatorio-${taskId}.txt`);
    const doneFile = path.join(tasksDir, `done-${taskId}.done`);
    const terminalLogFile = path.join(tasksDir, `terminal-${taskId}.log`);

    const promptContent = `[${new Date().toISOString()}] Você é o Agente Técnico Jarbas. Seu único objetivo é executar a tarefa técnica designada abaixo com foco, precisão e eficiência de máquina.

### CONTEXTO DA TAREFA ###
TÍTULO: ${task.title}
DESCRIÇÃO: ${task.description}

### REGRAS DO PROJETO (OBRIGATÓRIAS) ###
Front: /home/alexandrebragatorqueti/projetos/tarefas-web Porta 3000
Back: /home/alexandrebragatorqueti/projetos/tarefas-server Porta 3001

Não mexa em outras pastas ou portas. Nunca faça nada em ambiente de produção.

### REGRAS DE EDIÇÃO DE CÓDIGO (CRÍTICO E OBRIGATÓRIO) ###
Você NÃO É um assistente de chat. Você é um executor de sistema (Agent).
1. PROIBIDO MOSTRAR CÓDIGO: Nunca escreva a solução ou blocos de código na sua resposta de texto.
2. APLIQUE AS MUDANÇAS: Se você precisa alterar um arquivo, VOCÊ DEVE usar comandos de terminal para reescrever o arquivo físico no disco. 
3. FERRAMENTA OBRIGATÓRIA: Use a sintaxe Heredoc para aplicar as mudanças de forma segura. Exemplo:
cat << 'EOF' > /home/alexandrebragatorqueti/projetos/tarefas-web/caminho/do/arquivo.js
[SEU CÓDIGO COMPLETO AQUI]
EOF

### PROTOCOLO DE CONCLUSÃO (CRÍTICO) ###
Assim que finalizar as alterações no código, use OBRIGATORIAMENTE sua ferramenta de terminal (shell) para executar os dois passos abaixo:

1. Gere o relatório de execução usando a sintaxe Heredoc (EOF) para evitar erros de terminal:
cat << 'EOF' > "${relatorioFile}"
[Escreva seu relatorio técnico detalhado aqui]
EOF

2. Assine o contrato de finalização (Execute no terminal, não escreva no chat):
touch "${doneFile}"

Não explique suas ações. Apenas execute as ferramentas e encerre.`;

    try {
      await fs.writeFile(promptFile, promptContent);
      await fs.writeFile(relatorioFile, ''); // Mantido: o EOF vai sobrescrever com segurança
      await fs.writeFile(terminalLogFile, '');

      return {
        promptFile,
        relatorioFile,
        doneFile,
        terminalLogFile,
        promptContent
      };
    } catch (error) {
      await Logger.createLog({
        level: 'ERROR',
        endpoint: 'TaskExecutionService',
        method: 'prepareTaskFiles',
        message: `Erro ao preparar arquivos: ${error.message}`,
        errorType: error.constructor.name,
        stackTrace: error.stack
      });
      throw error;
    }
  }

  /**
   * Executa o OpenClaw via CLI
   * @param {string} promptContent - Conteúdo do prompt
   * @param {string} model - Modelo de IA
   * @param {string} tasksDir - Diretório de trabalho
   * @param {string} terminalLogFile - Arquivo de log do terminal
   * @param {number} timeoutMs - Timeout em milissegundos
   * @returns {Promise<Object>} Resultado da execução
   */
  /**
   * Executa o OpenClaw com isolamento por tarefa
   * @param {string} taskId - ID da tarefa (usado como session-id para isolamento)
   * @param {string} promptContent - Conteúdo do prompt
   * @param {string} model - Modelo de IA a ser utilizado
   * @param {string} tasksDir - Diretório de trabalho
   * @param {string} terminalLogFile - Arquivo de log do terminal
   * @param {number} timeoutMs - Timeout em milissegundos (padrão: 300000)
   * @returns {Promise<Object>} Resultado da execução
   */
  static async executeOpenClaw(taskId, promptContent, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 300000) {
    return new Promise((resolve, reject) => {
      const childArgs = [
        'agent',
        '--agent', 'programmer',
        '--session-id', taskId,
        '-m', promptContent,
        '--timeout', Math.floor(timeoutMs / 1000).toString(), // Converter ms para segundos
      ];

      const env = { ...process.env };
      
      // 🛑 CORREÇÃO CRÍTICA 1: Impede que o processo filho trave tentando usar a porta de debug da IDE
      delete env.NODE_OPTIONS; 

      // 🛑 CORREÇÃO CRÍTICA 2: Só injeta o modelo se ele for explicitamente enviado e diferente do padrão da nuvem.
      // Isso permite que o Qwen 2.5 local assuma o controle quando chamado.
      if (model && !model.includes('deepseek-chat')) {
        env.OPENCLAW_MODEL = model;
      }

      const executionDirectory = projectPath || tasksDir;
      const child = spawn("openclaw", childArgs, {
        cwd: executionDirectory,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      const zumbisAssassinados = new Set();

      const cacaZumbisEmTempoReal = (textoDoTerminal) => {
        if (!textoDoTerminal.includes('session file locked')) return;

        // 🛑 CORREÇÃO CRÍTICA 3: Regex arrumada (\d+ e \.lock)
        const regex = /pid=\d+\s+(.+\.lock)/g;
        let match;

        while ((match = regex.exec(textoDoTerminal)) !== null) {
          const pid = parseInt(match[1], 10);
          const lockFilePath = match[2];

          if (!zumbisAssassinados.has(pid)) {
            zumbisAssassinados.add(pid);
            console.log(`[Auto-Cura Real-Time] Zumbi detectado (PID: ${pid}). Agindo instantaneamente...`);

            try { process.kill(pid, 'SIGKILL'); } catch (err) {}
            // Removido o import duplicado do fs aqui, usando o global
            fs.unlink(lockFilePath).catch(() => {});
          }
        }
      };

      const timeoutTimer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({ exitCode: null, success: false, errorMessage: `Timeout após ${timeoutMs}ms`, output: stdout, errorOutput: stderr });
      }, timeoutMs);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        fs.appendFile(terminalLogFile, text).catch(() => {});
        cacaZumbisEmTempoReal(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        fs.appendFile(terminalLogFile, text).catch(() => {});
        cacaZumbisEmTempoReal(text);
      });

      child.on('error', (error) => {
        clearTimeout(timeoutTimer);
        reject({ exitCode: null, success: false, errorMessage: `Erro: ${error.message}`, output: stdout, errorOutput: stderr });
      });

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);
        resolve({ exitCode: code, success: code === 0, errorMessage: code !== 0 ? `Processo encerrado com código ${code}` : null, output: stdout, errorOutput: stderr });
      });
    });
  }

  static async resolveZombieLocks(errorOutput) {
    if (!errorOutput || !errorOutput.includes('session file locked')) return false;

    // 🛑 CORREÇÃO CRÍTICA 4: Regex arrumada no método estático
    const lockFileRegex = /pid=\d+\s+(.+\.lock)/g;
    let match;
    let locksCleared = false;

    while ((match = lockFileRegex.exec(errorOutput)) !== null) {
      const lockFilePath = match[1];
      try {
        await fs.unlink(lockFilePath);
        console.log(`[Auto-Cura] Arquivo zumbi removido com sucesso: ${lockFilePath}`);
        locksCleared = true;
      } catch (err) {}
    }
    return locksCleared;
  }
  /**
   * Analisa a saída de erro em busca de arquivos de lock travados e os deleta.
   * @param {string} errorOutput - O texto de erro retornado pelo OpenClaw
   * @returns {Promise<boolean>} Retorna true se encontrou e limpou algum lock
   */
  static async resolveZombieLocks(errorOutput) {
    if (!errorOutput || !errorOutput.includes('session file locked')) {
      return false; // Não é um erro de lock
    }

    // Regex para extrair o caminho do arquivo .lock da mensagem de erro
    // Exemplo de match: "pid=1501 /home/user/.openclaw/.../f4dae7e1.jsonl.lock"
    const lockFileRegex = /pid=\d+\s+(.+\.lock)/g;
    let match;
    let locksCleared = false;

    // Procura por todos os arquivos de lock mencionados no erro
    while ((match = lockFileRegex.exec(errorOutput)) !== null) {
      const lockFilePath = match[1];
      try {
        await fs.unlink(lockFilePath);
        console.log(`[Auto-Cura] Arquivo zumbi removido com sucesso: ${lockFilePath}`);
        locksCleared = true;
      } catch (err) {
        // Ignora se o arquivo já não existir
        if (err.code !== 'ENOENT') {
          console.error(`[Auto-Cura] Falha ao remover arquivo de lock: ${lockFilePath}`, err);
        }
      }
    }

    return locksCleared;
  }

  /**
   * Verifica se o contrato foi cumprido
   * @param {string} doneFile - Caminho do arquivo .done
   * @param {string} relatorioFile - Caminho do arquivo de relatório
   * @returns {Promise<Object>} Resultado da verificação
   */
  static async verifyContract(doneFile, relatorioFile, terminalLogFile) {
    try {
      const doneExists = await fs.access(doneFile).then(() => true).catch(() => false);
      let executionNotes = '';
      let relatorioValido = false;

      // Verifica se o relatório tem sustância (mais de 10 caracteres)
      try {
        const relatorioContent = await fs.readFile(relatorioFile, 'utf8');
        if (relatorioContent.trim().length > 10) {
          executionNotes = relatorioContent;
          relatorioValido = true;
        }
      } catch (error) {}

      // CENÁRIO 1: A IA fez o relatório, mesmo esquecendo o arquivo .done
      if (doneExists || relatorioValido) {
        if (!doneExists && relatorioValido) {
           await fs.writeFile(doneFile, ''); 
           console.log(`[Orquestrador] Agente esqueceu o .done, mas gerou o relatório. Contrato aceito automaticamente.`);
        }
        return {
          contractFulfilled: true,
          executionNotes: executionNotes || 'Concluído via contrato padrão.'
        };
      }

      // CENÁRIO 2: A IA não fez o relatório, mas tagarelou no terminal que terminou (ou cuspiu o caminho do .done lá)
      try {
        const logContent = await fs.readFile(terminalLogFile, 'utf8');
        const indicios = ['concluída', 'finished', 'concluído', 'tarefa finalizada', 'touch /home/'];
        
        if (indicios.some(termo => logContent.toLowerCase().includes(termo))) {
          console.log(`[Orquestrador] IA não acionou ferramentas finais, mas indicou sucesso no log. Contrato aceito.`);
          await fs.writeFile(doneFile, ''); 
          return {
            contractFulfilled: true,
            executionNotes: 'Concluído (verificado via análise de log). Relatório formal ausente.'
          };
        }
      } catch (logError) {}

      return {
        contractFulfilled: false,
        executionNotes: 'Arquivo .done não encontrado, relatório vazio e sem indícios de conclusão no log.'
      };
    } catch (error) {
      return { contractFulfilled: false, executionNotes: `Erro: ${error.message}` };
    }
  }

  /**
   * Move os arquivos temporários para a pasta "processed" no final da execução
   * @param {Object} files - Objeto com caminhos dos arquivos
   * @returns {Promise<void>}
   */
  static async cleanupFiles(files) {
    if (!files || !files.promptFile) return;

    try {
      // 1. Pega o diretório base (ex: tasksDir) a partir do caminho do promptFile
      const baseDir = path.dirname(files.promptFile);
      const processedDir = path.join(baseDir, 'processed');

      // 2. Cria a pasta 'processed' se ela não existir
      await fs.mkdir(processedDir, { recursive: true });

      // 3. Gera um sufixo de data/hora para não sobrescrever arquivos de tentativas anteriores
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const filesToMove = [
        files.promptFile,
        files.relatorioFile,
        files.doneFile,
        files.terminalLogFile
      ];

      for (const file of filesToMove) {
        try {
          // Verifica se o arquivo realmente foi criado antes de tentar mover
          await fs.access(file); 
          
          const fileName = path.basename(file);
          const ext = path.extname(fileName); // ex: .txt, .log
          const nameWithoutExt = path.basename(fileName, ext); // ex: prompt-123
          
          // Novo nome com timestamp: prompt-123_2026-03-05T...txt
          const newFileName = `${nameWithoutExt}_${timestamp}${ext}`;
          const destination = path.join(processedDir, newFileName);
          
          // Move o arquivo (rename faz a movimentação no mesmo disco)
          await fs.rename(file, destination);
        } catch (error) {
          // Se o arquivo não existir (ex: a IA não criou o .done), apenas ignora e segue a vida
          if (error.code !== 'ENOENT') {
             console.error(`[Aviso] Falha ao mover arquivo ${file}:`, error.message);
          }
        }
      }
      
      console.log(`📂 Limpeza concluída: Arquivos da tarefa movidos para a pasta 'processed'.`);
    } catch (error) {
      console.error(`❌ Erro fatal ao tentar mover arquivos para processed: ${error.message}`);
    }
  }

  /**
   * Método principal para executar uma tarefa
   * @param {Object} task - Objeto da tarefa
   * @param {string} userId - ID do usuário
   * @param {Object} config - Configuração
   * @returns {Promise<Object>} Resultado da execução
   */
  static async executeTask(task, userId, config) {
    const { TASKS_DIR, TASK_TIMEOUT_MS = 300000 } = config;
    let executionLog = null;
    let files = null;

    try {
      // 1. Cria log de execução
      log(`📝 Criando log de execução para tarefa ${task.id}...`);
      executionLog = await this.createExecutionLog(task, userId, task.model);

      // 2. Prepara arquivos
      log(`📝 Preparando arquivos para execução da tarefa ${task.id}...`);
      files = await this.prepareTaskFiles(task, TASKS_DIR);

      // 3. Executa OpenClaw com isolamento por tarefa
            // Busca o projeto para obter a pasta base
      log(`📝 Executando OpenClaw para tarefa ${task.id}...`);
      const project = await prisma.project.findUnique({
        where: { id: task.projectId },
        select: { pastaBase: true }
      });

      log(`🤖 Iniciando execução do OpenClaw para tarefa ${task.id} com modelo ${task.model}...`);
      let executionResult = await this.executeOpenClaw(
        task.id, // Passando o ID da tarefa para isolamento de sessão
        files.promptContent,
        task.model,
        TASKS_DIR,
        files.terminalLogFile,
        project?.pastaBase || null,
        TASK_TIMEOUT_MS
      );
      log(`🤖 Execução do OpenClaw para tarefa ${task.id} finalizada. Verificando resultado...`);
      // NOVO: Sistema de Auto-cura para arquivos de lock zumbis
      if (!executionResult.success && executionResult.errorOutput) {
        const hasClearedLocks = await this.resolveZombieLocks(executionResult.errorOutput);
        
        // Se limpou algum lock, significa que o erro foi isso. Vamos tentar rodar só mais uma vez!
        if (hasClearedLocks) {
          await Logger.createLog({
            level: 'WARN',
            endpoint: 'TaskExecutionService',
            method: 'executeTask',
            message: `Retentando tarefa ${task.id} após limpar arquivos de lock zumbis.`
          });

          // Retentativa com isolamento garantido
          executionResult = await this.executeOpenClaw(
            task.id,
            files.promptContent,
            task.model,
            TASKS_DIR,
            files.terminalLogFile,
            project?.pastaBase || null,
            TASK_TIMEOUT_MS
          );
        }
      }

      // 4. Verifica contrato
      // O QUE ESTÁ HOJE:
      // const contractResult = await this.verifyContract(files.doneFile, files.relatorioFile);

      // COMO DEVE FICAR:
      const contractResult = await this.verifyContract(files.doneFile, files.relatorioFile, files.terminalLogFile);
      // 5. Prepara resultado final
      const finalResult = {
        success: executionResult.success && contractResult.contractFulfilled,
        exitCode: executionResult.exitCode,
        errorMessage: executionResult.errorMessage || (contractResult.contractFulfilled ? null : 'Contrato não cumprido'),
        executionNotes: contractResult.executionNotes
      };

      // 6. Finaliza log
      await this.finishExecutionLog(executionLog.id, finalResult);

      // 7. Limpa arquivos
      await this.cleanupFiles(files);

      return {
        ...finalResult,
        taskId: task.id,
        executionLogId: executionLog.id
      };

    } catch (error) {
      // Em caso de erro, tenta finalizar o log com informações de erro
      if (executionLog) {
        try {
          await this.finishExecutionLog(executionLog.id, {
            success: false,
            errorMessage: error.message,
            executionNotes: `Erro durante execução: ${error.message}`
          });
        } catch (finishError) {
          // Ignora erro ao tentar finalizar
        }
      }

      // Tenta limpar arquivos mesmo em caso de erro
      if (files) {
        try {
          await this.cleanupFiles(files);
        } catch (cleanupError) {
          // Ignora erro de limpeza
        }
      }

      throw error;
    }
  }
}

module.exports = TaskExecutionService;

