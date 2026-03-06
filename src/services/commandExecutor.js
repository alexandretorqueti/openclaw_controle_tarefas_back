// commandExecutor.js - Executor de comandos para OpenClaw
const { execSync } = require('child_process');

class CommandExecutor {
  /**
   * Extrai comandos do output do OpenClaw
   */
  static extractCommands(openclawOutput) {
    const commands = [];
    let inHeredoc = false;
    let heredocDelimiter = '';
    
    const lines = openclawOutput.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      // Detecta início de Heredoc
      if (line.startsWith('cat') && line.includes('<<') && !inHeredoc) {
        inHeredoc = true;
        // Extrai o delimitador (ex: 'EOF')
        const match = line.match(/<<\s*['"]?(\w+)['"]?/);
        heredocDelimiter = match ? match[1] : 'EOF';
        commands.push(line); // Adiciona o comando cat
        continue;
      }
      
      // Detecta fim de Heredoc
      if (inHeredoc && line === heredocDelimiter) {
        inHeredoc = false;
        heredocDelimiter = '';
        continue;
      }
      
      // Se estiver dentro de Heredoc, ignora
      if (inHeredoc) {
        continue;
      }
      
      // Detecta comandos shell válidos
      if (this.isValidShellCommand(line)) {
        commands.push(line);
      }
    }
    
    return commands;
  }
  
  /**
   * Verifica se é um comando shell válido
   */
  static isValidShellCommand(line) {
    // Comandos válidos
    const validCommands = [
      /^echo\s+.*?>/,
      /^touch\s+/,
      /^mkdir\s+/,
      /^cp\s+/,
      /^mv\s+/,
      /^rm\s+/,
      /^cat\s+.*?<</,
      /^chmod\s+/,
      /^chown\s+/,
      /^git\s+/,
      /^npm\s+/,
      /^yarn\s+/,
      /^pip\s+/,
      /^python3?\s+/,
      /^node\s+/,
      /^curl\s+/,
      /^wget\s+/,
      /^tar\s+/,
      /^unzip\s+/,
      /^zip\s+/
    ];
    
    // Ignora comentários, linhas vazias, e algumas construções
    if (!line || 
        line.startsWith('#') || 
        line.startsWith('if ') || 
        line.startsWith('else') || 
        line.startsWith('fi') ||
        line.startsWith('then') ||
        line.startsWith('fi;') ||
        line.includes('**') || // Markdown bold
        line.match(/^\d+\.\s+\*\*/) || // Lista numerada com markdown
        line.startsWith('- ') || // Lista com marcador
        line.startsWith('ALTERAÇÕES') ||
        line.startsWith('STATUS') ||
        line.startsWith('O arquivo')) {
      return false;
    }
    
    // Verifica se é um comando válido
    return validCommands.some(regex => regex.test(line));
  }
  
  /**
   * Executa um comando shell de forma segura
   */
  static executeCommand(command, cwd = process.cwd()) {
    console.log(`   [CommandExecutor] Executando: ${command.substring(0, 80)}${command.length > 80 ? '...' : ''}`);
    
    try {
      // Para comandos com redirecionamento ou Heredoc, usa shell
      if (command.includes('>') || command.includes('|') || command.includes('<<')) {
        const result = execSync(command, { 
          cwd, 
          encoding: 'utf8',
          shell: '/bin/bash',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(`   [CommandExecutor] ✅ Sucesso`);
        return { success: true, output: result };
      } else {
        // Para comandos simples
        const result = execSync(command, { 
          cwd, 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(`   [CommandExecutor] ✅ Sucesso`);
        return { success: true, output: result };
      }
    } catch (error) {
      console.log(`   [CommandExecutor] ❌ Erro: ${error.message.substring(0, 100)}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Processa output do OpenClaw e executa comandos
   */
  static processOpenClawOutput(openclawOutput, taskId, cwd = process.cwd()) {
    console.log(`[CommandExecutor] Processando output do OpenClaw para tarefa ${taskId}...`);
    
    const commands = this.extractCommands(openclawOutput);
    console.log(`[CommandExecutor] ${commands.length} comandos válidos encontrados`);
    
    const results = [];
    for (const command of commands) {
      const result = this.executeCommand(command, cwd);
      results.push({ command, ...result });
    }
    
    return {
      totalCommands: commands.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}

module.exports = CommandExecutor;