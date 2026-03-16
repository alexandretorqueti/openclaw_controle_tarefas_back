

// src/services/openclawService.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const ToolCallService = require('./toolCallService');
const CommandExecutor = require('./commandExecutor');
const { log } =  require('../../aux/logger');

const OPENCLAW_NODE = '/home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin/node';
const OPENCLAW_MJS = '/home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/lib/node_modules/openclaw/openclaw.mjs';
class OpenClawService {
  /**
   * Executa uma chamada ao agente via CLI do OpenClaw
   */
  static async execute(taskId, inputMessage, agent, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 14400000) {
    return new Promise((resolve) => {
      // 1. Prepara os argumentos (compatível com qualquer modelo)
      const childArgs = [
        'agent', 
        '--agent', agent, 
        '--session-id', taskId, 
        '-m', inputMessage, 
        '--timeout', Math.floor(timeoutMs / 1000).toString()
      ];
      
      const env = { ...process.env };
      delete env.NODE_OPTIONS;
      
      // Proteção contra modelos que não suportam thinking (opcional, se você implementou)
      const thinkingModels = ['deepseek-r1', 'qwq', 'reasoner'];
      const canThink = model && thinkingModels.some(m => model.toLowerCase().includes(m));
      if (!canThink) {
        env.OPENCLAW_THINKING = 'false';
      }

      if (model && !model.includes('deepseek-chat')) {
        env.OPENCLAW_MODEL = model;
      }

      const fsSync = require('fs');
      const spawnCwd = (projectPath && fsSync.existsSync(projectPath)) ? projectPath
                     : (tasksDir && fsSync.existsSync(tasksDir)) ? tasksDir
                     : require('os').homedir();

      // 2. Inicia o processo do OpenClaw
      const child = spawn(OPENCLAW_NODE, [OPENCLAW_MJS, ...childArgs], { 
        cwd: spawnCwd, 
        env, 
        shell: false, 
        stdio: ['ignore', 'pipe', 'pipe'] 
      });

      let stdout = ''; 
      let stderr = ''; 
      let isSettled = false; 

      const settle = (result) => { 
        if (isSettled) return; 
        isSettled = true; 
        clearTimeout(timeoutTimer); 
        resolve(result); 
      };

      // 3. Timeout de segurança global
      const timeoutTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (_) {}
        settle({ success: false, errorMessage: `Timeout global atingido (${timeoutMs}ms)`, rawOutput: stdout + stderr });
      }, timeoutMs);

      // 4. Captura silenciosa de dados (O Padrão Supervisor)
      const onData = async (data, source) => {
        if (isSettled) return;
        const text = data.toString();
        source === 'stdout' ? (stdout += text) : (stderr += text);
        
        // Imprime no seu console para você acompanhar ao vivo
        log(text);

        // Salva no arquivo de log da tarefa
        fs.appendFile(terminalLogFile, text).catch(() => {});
        
        // ==========================================
        // MUDANÇA CRÍTICA: Não interceptamos mais!
        // Deixamos o OpenClaw executar as ferramentas nativamente
        // e conversar com a nuvem/ollama na linguagem correta.
        // ==========================================
      };

      child.stdout.on('data', (d) => onData(d, 'stdout'));
      child.stderr.on('data', (d) => onData(d, 'stderr'));
      
      // 5. O OpenClaw só avisa quando realmente terminar (ou travar)
      child.on('close', (code) => { 
        settle({ 
            success: code === 0, 
            rawOutput: stdout + stderr, 
            errorMessage: code === 0 ? null : `Processo encerrado com código ${code}` 
        }); 
      });
    });
  }

  /**
   * Executa uma chamada ao agente, mas se ele falhar ou travar, 
   * tenta novamente com um agente de backup (Fallback).
   */
  static async executeWithFallback(
    taskId, inputMessage, primaryAgent, fallbackAgent, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 14400000
  ) {
    await log(`🤖 [OpenClaw] Tentando executar com o agente principal: ${primaryAgent}`);
    
    try {
      // 1. Tenta com o agente principal
      let result = await this.execute(
        taskId, inputMessage, primaryAgent, model, tasksDir, terminalLogFile, projectPath, timeoutMs
      );

      // 2. Define o que é uma "Falha Crítica" que merece chamar o backup
      // Adapte essa regra conforme os erros que você mais vê no terminal
      const isCriticalFailure = 
        !result.success || 
        (result.errorMessage && result.errorMessage.toLowerCase().includes('error')) ||
        (result.rawOutput && result.rawOutput.includes('gateway closed')) ||
        (result.rawOutput && result.rawOutput.includes('does not support'));

      if (isCriticalFailure) {
        await log(`⚠️ [OpenClaw] Agente principal (${primaryAgent}) falhou ou travou. Acionando agente de resgate: ${fallbackAgent}...`);
        
        // 3. (Opcional) Adiciona uma nota para o agente de resgate saber que ele é o plano B
        const rescueInput = `${inputMessage}\n\n[SISTEMA - MODO RESGATE] O agente anterior tentou executar esta tarefa e sofreu uma falha crítica no sistema. Assuma o controle e tente uma abordagem mais simples e direta.`;
        
        // 4. Chama o backup
        result = await this.execute(
          taskId, rescueInput, fallbackAgent, model, tasksDir, terminalLogFile, projectPath, timeoutMs
        );
        
        await log(`🚑 [OpenClaw] Execução de resgate com ${fallbackAgent} finalizada. Sucesso: ${result.success}`);
      }

      return result;

    } catch (error) {
      // Se a própria função `execute` estourar uma exceção (throw), nós capturamos aqui e acionamos o backup
      await log(`💥 [OpenClaw] Erro fatal (Exception) com ${primaryAgent}: ${error.message}. Acionando resgate: ${fallbackAgent}...`);
      
      return await this.execute(
        taskId, inputMessage, fallbackAgent, model, tasksDir, terminalLogFile, projectPath, timeoutMs
      );
    }
  }
}

module.exports = OpenClawService;

