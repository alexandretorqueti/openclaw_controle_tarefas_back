const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/services/taskExecutionService.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update the executeOpenClaw method signature and implementation
const oldExecuteOpenClaw = `  static async executeOpenClaw(promptContent, model, tasksDir, terminalLogFile, timeoutMs = 300000) {
    return new Promise((resolve, reject) => {
      const childArgs = [
        'agent',
        '--session-id', 'task-execution',
        '-m', promptContent
      ];`;

const newExecuteOpenClaw = `  /**
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
      ];`;

// Replace the old method signature and comment
content = content.replace(oldExecuteOpenClaw, newExecuteOpenClaw);

// 2. Add the resolveZombieLocks method after executeOpenClaw
const resolveZombieLocksMethod = `
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
    const lockFileRegex = /pid=\d+\\s+(.+\.lock)/g;
    let match;
    let locksCleared = false;

    // Procura por todos os arquivos de lock mencionados no erro
    while ((match = lockFileRegex.exec(errorOutput)) !== null) {
      const lockFilePath = match[1];
      try {
        await fs.unlink(lockFilePath);
        console.log(\`[Auto-Cura] Arquivo zumbi removido com sucesso: \${lockFilePath}\`);
        locksCleared = true;
      } catch (err) {
        // Ignora se o arquivo já não existir
        if (err.code !== 'ENOENT') {
          console.error(\`[Auto-Cura] Falha ao remover arquivo de lock: \${lockFilePath}\`, err);
        }
      }
    }

    return locksCleared;
  }`;

// Find where to insert the new method - after executeOpenClaw
const executeOpenClawEnd = '    });\n  }';
const executeOpenClawEndIndex = content.indexOf(executeOpenClawEnd);
if (executeOpenClawEndIndex !== -1) {
  const insertIndex = executeOpenClawEndIndex + executeOpenClawEnd.length;
  content = content.slice(0, insertIndex) + resolveZombieLocksMethod + content.slice(insertIndex);
}

// 3. Update the executeTask method to use the new executeOpenClaw signature and implement auto-healing
const oldExecuteTaskCall = `      // 3. Executa OpenClaw
      const executionResult = await this.executeOpenClaw(
        files.promptContent,
        task.model,
        TASKS_DIR,
        files.terminalLogFile,
        TASK_TIMEOUT_MS
      );`;

const newExecuteTaskCall = `      // 3. Executa OpenClaw com isolamento por tarefa
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
            message: \`Retentando tarefa \${task.id} após limpar arquivos de lock zumbis.\`
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
      }`;

// Replace the old executeTask call with the new one
content = content.replace(oldExecuteTaskCall, newExecuteTaskCall);

// Write the updated content back to the file
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Sistema de recuperação de falhas implementado com sucesso!');
console.log('✅ 1. executeOpenClaw atualizado para usar taskId como session-id');
console.log('✅ 2. Método resolveZombieLocks adicionado para limpeza automática');
console.log('✅ 3. Sistema de auto-cura implementado no executeTask');
