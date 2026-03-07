// commandExecutor.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CommandExecutor {
  /**
   * Executa a ferramenta baseada no JSON extraído do output da IA
   * @param {Object} toolCall - Objeto parseado (ex: { name: 'exec', arguments: { command: '...' } })
   * @param {string} cwd - Diretório de trabalho (projectPath)
   * @returns {Object} - Resultado da execução { success: boolean, output: string, error?: string }
   */
  static async executeTool(toolCall, cwd = process.cwd()) {
    const { name, arguments: args } = toolCall;
    console.log(`\n   [CommandExecutor] 🤖 Acionando ferramenta: [${name.toUpperCase()}]`);
    
    try {
      switch (name) {
        case 'exec':
          return this.executeExecCommand(args.command, cwd);
        
        case 'read':
          return this.executeReadCommand(args.file_path);
        
        case 'write':
          return this.executeWriteCommand(args.file_path, args.content);
        
        case 'edit':
          return this.executeEditCommand(args.file_path, args.oldText, args.newText);
        
        default:
          console.log(`   [CommandExecutor] ❌ Ferramenta desconhecida: ${name}`);
          return { success: false, error: `Ferramenta '${name}' não é suportada pelo sistema.` };
      }
    } catch (error) {
      console.log(`   [CommandExecutor] ❌ Erro fatal na ferramenta ${name}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  static executeExecCommand(command, cwd) {
    if (!command) return { success: false, error: "Parâmetro 'command' ausente." };
    console.log(`   [CommandExecutor] 🖥️  Terminal: ${command.substring(0, 60)}${command.length > 60 ? '...' : ''}`);
    
    try {
      const result = execSync(command, { 
        cwd, 
        encoding: 'utf8', 
        shell: '/bin/bash',
        timeout: 30000 // Limite de 30s para evitar travamento em comandos infinitos
      });
      console.log(`   [CommandExecutor] ✅ Executado com sucesso`);
      return { success: true, output: result || "Comando executado sem retorno visual (sucesso)." };
    } catch (error) {
      // Se o comando falhar (ex: grep não achou nada), retornamos o erro para a IA tentar novamente
      return { success: false, error: `Exit code ${error.status}: ${error.stderr || error.message}` };
    }
  }

  static executeReadCommand(filePath) {
    if (!filePath) return { success: false, error: "Parâmetro 'file_path' ausente." };
    console.log(`   [CommandExecutor] 📖 Lendo: ${path.basename(filePath)}`);
    
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Arquivo não encontrado: ${filePath}` };
      }
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`   [CommandExecutor] ✅ Arquivo lido (${content.length} caracteres)`);
      return { success: true, output: content };
    } catch (error) {
      return { success: false, error: `Erro de leitura: ${error.message}` };
    }
  }

  static executeWriteCommand(filePath, content) {
    if (!filePath || content === undefined) return { success: false, error: "Parâmetros 'file_path' ou 'content' ausentes." };
    console.log(`   [CommandExecutor] 📝 Escrevendo/Criando: ${path.basename(filePath)}`);
    
    try {
      // Garante que o diretório pai existe
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`   [CommandExecutor] ✅ Arquivo salvo`);
      return { success: true, output: `Arquivo ${filePath} criado/sobrescrito com sucesso.` };
    } catch (error) {
      return { success: false, error: `Erro de escrita: ${error.message}` };
    }
  }

  static executeEditCommand(filePath, oldText, newText) {
    if (!filePath || !oldText || newText === undefined) return { success: false, error: "Parâmetros inválidos para edit." };
    console.log(`   [CommandExecutor] ✂️  Editando trecho em: ${path.basename(filePath)}`);
    
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Arquivo não encontrado: ${filePath}` };
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (!content.includes(oldText)) {
        console.log(`   [CommandExecutor] ⚠️ Aviso: 'oldText' não encontrado no arquivo.`);
        return { success: false, error: `O texto exato fornecido em 'oldText' não foi encontrado no arquivo. Use a ferramenta 'read' primeiro para copiar o texto exato do código-fonte.` };
      }
      
      const newContent = content.replace(oldText, newText);
      fs.writeFileSync(filePath, newContent, 'utf8');
      
      console.log(`   [CommandExecutor] ✅ Arquivo modificado com sucesso`);
      return { success: true, output: `Substituição realizada com sucesso no arquivo ${filePath}.` };
    } catch (error) {
      return { success: false, error: `Erro ao editar: ${error.message}` };
    }
  }
}

module.exports = CommandExecutor;