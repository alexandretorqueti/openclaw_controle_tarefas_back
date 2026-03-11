// src/services/openclawService.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const ToolCallService = require('./toolCallService');
const CommandExecutor = require('./commandExecutor');

class OpenClawService {
  /**
   * Executa uma chamada ao agente via CLI do OpenClaw
   */
  static async execute(taskId, inputMessage, agent, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 14400000) {
    return new Promise((resolve) => {
      const childArgs = [
        'agent', 
        '--agent', agent, 
        '--session-id', taskId, 
        '-m', inputMessage, 
        '--timeout', Math.floor(timeoutMs / 1000).toString()
      ];
      
      const env = { ...process.env };
      delete env.NODE_OPTIONS;
      
      if (model && !model.includes('deepseek-chat')) {
        env.OPENCLAW_MODEL = model;
      }

      const child = spawn('openclaw', childArgs, { 
        cwd: projectPath || tasksDir, 
        env, 
        shell: false, 
        stdio: ['ignore', 'pipe', 'pipe'] 
      });

      let stdout = ''; 
      let stderr = ''; 
      let streamBuffer = ''; 
      let isSettled = false; 
      let toolStarted = false;

      const settle = (result) => { 
        if (isSettled) return; 
        isSettled = true; 
        clearTimeout(timeoutTimer); 
        resolve(result); 
      };

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
          settle({ 
            success: result.success, 
            toolFeedback: `[RESULTADO] ${result.output || result.error}`, 
            toolCall, 
            toolResult: result, 
            rawOutput: stdout + stderr 
          });
        }
      };

      child.stdout.on('data', (d) => onData(d, 'stdout'));
      child.stderr.on('data', (d) => onData(d, 'stderr'));
      
      child.on('close', (code) => { 
        if (!toolStarted) {
          settle({ success: code === 0, rawOutput: stdout + stderr, errorMessage: code === 0 ? null : `Erro ${code}` }); 
        }
      });
    });
  }
}

module.exports = OpenClawService;