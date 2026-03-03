// taskExecutionService.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { Logger } = require('../utils/logger');
const prisma = new PrismaClient();

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

      await Logger.createLog({
        level: 'INFO',
        endpoint: 'TaskExecutionService',
        method: 'createExecutionLog',
        message: `Log de execução criado para tarefa ${task.id}`,
        userId: userId
      });

      return executionLog;
    } catch (error) {
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

    // Cria o conteúdo do prompt
    const promptContent = `[${new Date().toISOString()}] Você é o Agente Técnico Jarbas. Seu único objetivo é executar a tarefa técnica designada abaixo com foco, precisão e eficiência de máquina.

### CONTEXTO DA TAREFA ###
TÍTULO: ${task.title}
DESCRIÇÃO: ${task.description}

### COMENTÁRIOS E HISTÓRICO DA TAREFA ###


### REGRAS DO PROJETO (OBRIGATÓRIAS) ###
Front: /home/alexandrebragatorqueti/projetos/tarefas-web Porta 3000
Back: /home/alexandrebragatorqueti/projetos/tarefas-server Porta 3001

Não mexa em outras pastas ou portas.
Nunca faça nada em ambiente de produção.

### PROTOCOLO DE CONCLUSÃO (CRÍTICO E OBRIGATÓRIO) ###
Assim que você finalizar as alterações e testes necessários no código, você DEVE executar os dois passos abaixo usando suas ferramentas de terminal, exatamente nesta ordem:

1. Gere o relatório de execução:
Crie ou sobrescreva o arquivo abaixo detalhando as ações tomadas, os arquivos modificados e as eventuais pendências.
Comando esperado: echo "Seu relatorio técnico aqui..." > /home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/relatorio-${taskId}.txt

2. Assine o contrato de finalização:
Crie um arquivo vazio no caminho abaixo. ISSO É VITAL. O orquestrador do sistema está aguardando a existência deste arquivo para liberar a GPU e marcar a tarefa como concluída.
Comando esperado: touch /home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/done-${taskId}.done

Restrições:
Não explique suas ações no chat. Apenas execute a tarefa, crie os dois arquivos usando a ferramenta de terminal e encerre sua execução imediamente.`;

    try {
      await fs.writeFile(promptFile, promptContent);
      await fs.writeFile(relatorioFile, '');
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
        message: `Erro ao preparar arquivos da tarefa: ${error.message}`,
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
  static async executeOpenClaw(taskId, promptContent, model, tasksDir, terminalLogFile, timeoutMs = 300000) {
    return new Promise((resolve, reject) => {
      const childArgs = [
        'agent',
        '--session-id', taskId, // Usando o ID da tarefa como session-id para isolamento
        '-m', promptContent
      ];

      const env = { ...process.env };
      if (model) {
        env.OPENCLAW_MODEL = model;
      }

      const child = spawn('openclaw', childArgs, {
        cwd: tasksDir,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      // Timeout
      const timeoutTimer = setTimeout(() => {
        child.kill('SIGKILL');
        if (child.stdout) child.stdout.destroy();
        if (child.stderr) child.stderr.destroy();
        
        resolve({
          exitCode: null,
          success: false,
          errorMessage: `Timeout após ${timeoutMs}ms`,
          output: stdout,
          errorOutput: stderr
        });
      }, timeoutMs);

      // Captura stdout
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        fs.appendFile(terminalLogFile, text).catch(() => {});
      });

      // Captura stderr
      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        fs.appendFile(terminalLogFile, text).catch(() => {});
      });

      child.on('error', (error) => {
        clearTimeout(timeoutTimer);
        reject({
          exitCode: null,
          success: false,
          errorMessage: `Erro ao executar OpenClaw: ${error.message}`,
          output: stdout,
          errorOutput: stderr
        });
      });

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);
        resolve({
          exitCode: code,
          success: code === 0,
          errorMessage: code !== 0 ? `Processo encerrado com código ${code}` : null,
          output: stdout,
          errorOutput: stderr
        });
      });
    });
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
    const lockFileRegex = /pid=d+\s+(.+.lock)/g;
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
  static async verifyContract(doneFile, relatorioFile) {
    try {
      const doneExists = await fs.access(doneFile).then(() => true).catch(() => false);
      
      if (!doneExists) {
        return {
          contractFulfilled: false,
          executionNotes: 'Arquivo .done não encontrado - contrato não cumprido'
        };
      }

      let executionNotes = 'Concluído. Relatório vazio ou não gerado.';
      try {
        const relatorioContent = await fs.readFile(relatorioFile, 'utf8');
        if (relatorioContent.trim()) {
          executionNotes = relatorioContent;
        }
      } catch (error) {
        // Arquivo de relatório não existe ou não pode ser lido
      }

      return {
        contractFulfilled: true,
        executionNotes
      };
    } catch (error) {
      await Logger.createLog({
        level: 'ERROR',
        endpoint: 'TaskExecutionService',
        method: 'verifyContract',
        message: `Erro ao verificar contrato: ${error.message}`,
        errorType: error.constructor.name,
        stackTrace: error.stack
      });
      
      return {
        contractFulfilled: false,
        executionNotes: `Erro ao verificar contrato: ${error.message}`
      };
    }
  }

  /**
   * Limpa arquivos temporários
   * @param {Object} files - Objeto com caminhos dos arquivos
   * @returns {Promise<void>}
   */
  static async cleanupFiles(files) {
    const filesToDelete = [
      files.promptFile,
      files.relatorioFile,
      files.doneFile,
      files.terminalLogFile
    ];

    for (const file of filesToDelete) {
      try {
        await fs.access(file);
        await fs.unlink(file);
      } catch (error) {
        // Arquivo não existe, ignora
      }
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
      executionLog = await this.createExecutionLog(task, userId, task.model);

      // 2. Prepara arquivos
      files = await this.prepareTaskFiles(task, TASKS_DIR);

      // 3. Executa OpenClaw com isolamento por tarefa
      let executionResult = await this.executeOpenClaw(
        task.id, // Passando o ID da tarefa para isolamento de sessão
        files.promptContent,
        task.model,
        TASKS_DIR,
        files.terminalLogFile,
        TASK_TIMEOUT_MS
      );

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
            TASK_TIMEOUT_MS
          );
        }
      }

      // 4. Verifica contrato
      const contractResult = await this.verifyContract(files.doneFile, files.relatorioFile);

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

