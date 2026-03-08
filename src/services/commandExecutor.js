// services/commandExecutor.js

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CommandExecutor {
  /**
   * Executa a ferramenta baseada no JSON extraído do output da IA
   * @param {Object} toolCall - Objeto parseado (ex: { name: 'exec', arguments: { command: '...' } })
   * @param {string} cwd - Diretório de trabalho (projectPath)
   * @returns {Object} - Resultado da execução
   */
  static async executeTool(toolCall, cwd = process.cwd()) {
    const name = toolCall?.name;
    const args = toolCall?.arguments || {};

    if (!name) {
      return this.buildResult(false, {
        error: "Ferramenta inválida: campo 'name' ausente."
      });
    }

    console.log(`\n   [CommandExecutor] 🤖 Acionando ferramenta: [${name.toUpperCase()}]`);

    try {
      switch (name) {
        case 'exec':
          return this.executeExecCommand(args.command, cwd);

        case 'read':
          return this.executeReadCommand(args.file_path, cwd);

        case 'write':
          return this.executeWriteCommand(args.file_path, args.content, cwd);

        case 'edit':
          return this.executeEditCommand(args.file_path, args.oldText, args.newText, cwd);

        default:
          console.log(`   [CommandExecutor] ❌ Ferramenta desconhecida: ${name}`);
          return this.buildResult(false, {
            error: `Ferramenta '${name}' não é suportada pelo sistema.`
          });
      }
    } catch (error) {
      console.log(`   [CommandExecutor] ❌ Erro fatal na ferramenta ${name}: ${error.message}`);
      return this.buildResult(false, {
        error: error.message
      });
    }
  }

  static buildResult(success, data = {}) {
    return {
      success,
      output: data.output || '',
      error: data.error || null,
      filesRead: data.filesRead || [],
      filesWritten: data.filesWritten || [],
      modifiedFiles: data.modifiedFiles || [],
      touchedFiles: data.touchedFiles || [],
      commandExecuted: data.commandExecuted || null
    };
  }

  static resolveFilePath(filePath, cwd) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Caminho de arquivo inválido.');
    }

    return path.isAbsolute(filePath)
      ? filePath
      : path.resolve(cwd, filePath);
  }

  static truncateOutput(text, max = 20000) {
    const value = String(text || '');
    if (value.length <= max) return value;
    return `${value.slice(0, max)}\n...[OUTPUT TRUNCADO]`;
  }

  static executeExecCommand(command, cwd) {
    if (!command) {
      return this.buildResult(false, {
        error: "Parâmetro 'command' ausente."
      });
    }

    console.log(`   [CommandExecutor] 🖥️  Terminal: ${command.substring(0, 60)}${command.length > 60 ? '...' : ''}`);

    try {
      const result = spawnSync('/bin/bash', ['-lc', command], {
        cwd,
        encoding: 'utf8',
        timeout: 240000, // 4 minutos para evitar travamentos
        maxBuffer: 20 * 1024 * 1024
      });

      const stdout = result.stdout || '';
      const stderr = result.stderr || '';
      const combinedOutput = `${stdout}${stderr}`.trim();

      if (result.error) {
        return this.buildResult(false, {
          error: this.truncateOutput(`Exit code ${result.status}: ${result.error.message}\n${combinedOutput}`.trim()),
          output: this.truncateOutput(`Exit code ${result.status}: ${result.error.message}\n${combinedOutput}`.trim()),
          commandExecuted: command
        });
      }

      if (typeof result.status === 'number' && result.status !== 0) {
        const errorOutput = this.truncateOutput(
          `Exit code ${result.status}: ${combinedOutput || 'Comando falhou sem saída detalhada.'}`
        );

        return this.buildResult(false, {
          error: errorOutput,
          output: errorOutput,
          commandExecuted: command
        });
      }

      const safeOutput = this.truncateOutput(
        combinedOutput || 'Comando executado sem retorno visual (sucesso).'
      );

      console.log(`   [CommandExecutor] ✅ Executado com sucesso`);

      return this.buildResult(true, {
        output: safeOutput,
        commandExecuted: command
      });
    } catch (error) {
      const errorOutput = this.truncateOutput(`Erro ao executar comando: ${error.message}`);
      return this.buildResult(false, {
        error: errorOutput,
        output: errorOutput,
        commandExecuted: command
      });
    }
  }

  static executeReadCommand(filePath, cwd) {
    if (!filePath) {
      return this.buildResult(false, {
        error: "Parâmetro 'file_path' ausente."
      });
    }

    try {
      const resolvedPath = this.resolveFilePath(filePath, cwd);

      console.log(`   [CommandExecutor] 📖 Lendo: ${path.basename(resolvedPath)}`);

      if (!fs.existsSync(resolvedPath)) {
        return this.buildResult(false, {
          error: `Arquivo não encontrado: ${resolvedPath}`,
          output: `Arquivo não encontrado: ${resolvedPath}`,
          touchedFiles: [resolvedPath]
        });
      }

      const content = fs.readFileSync(resolvedPath, 'utf8');

      console.log(`   [CommandExecutor] ✅ Arquivo lido (${content.length} caracteres)`);

      return this.buildResult(true, {
        output: this.truncateOutput(content),
        filesRead: [resolvedPath],
        touchedFiles: [resolvedPath]
      });
    } catch (error) {
      return this.buildResult(false, {
        error: `Erro de leitura: ${error.message}`,
        output: `Erro de leitura: ${error.message}`
      });
    }
  }

  static executeWriteCommand(filePath, content, cwd) {
    if (!filePath || content === undefined) {
      return this.buildResult(false, {
        error: "Parâmetros 'file_path' ou 'content' ausentes."
      });
    }

    try {
      const resolvedPath = this.resolveFilePath(filePath, cwd);

      console.log(`   [CommandExecutor] 📝 Escrevendo/Criando: ${path.basename(resolvedPath)}`);

      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(resolvedPath, content, 'utf8');

      console.log(`   [CommandExecutor] ✅ Arquivo salvo`);

      return this.buildResult(true, {
        output: `Arquivo ${resolvedPath} criado/sobrescrito com sucesso.`,
        filesWritten: [resolvedPath],
        modifiedFiles: [resolvedPath],
        touchedFiles: [resolvedPath]
      });
    } catch (error) {
      return this.buildResult(false, {
        error: `Erro de escrita: ${error.message}`,
        output: `Erro de escrita: ${error.message}`
      });
    }
  }

  static executeEditCommand(filePath, oldText, newText, cwd) {
    if (!filePath || !oldText || newText === undefined) {
      return this.buildResult(false, {
        error: "Parâmetros inválidos para edit."
      });
    }

    try {
      const resolvedPath = this.resolveFilePath(filePath, cwd);

      console.log(`   [CommandExecutor] ✂️  Editando trecho em: ${path.basename(resolvedPath)}`);

      if (!fs.existsSync(resolvedPath)) {
        return this.buildResult(false, {
          error: `Arquivo não encontrado: ${resolvedPath}`,
          output: `Arquivo não encontrado: ${resolvedPath}`,
          touchedFiles: [resolvedPath]
        });
      }

      const content = fs.readFileSync(resolvedPath, 'utf8');

      if (!content.includes(oldText)) {
        console.log(`   [CommandExecutor] ⚠️ Aviso: 'oldText' não encontrado no arquivo.`);
        return this.buildResult(false, {
          error: `O texto exato fornecido em 'oldText' não foi encontrado no arquivo. Use a ferramenta 'read' primeiro para copiar o texto exato do código-fonte.`,
          output: `O texto exato fornecido em 'oldText' não foi encontrado no arquivo. Use a ferramenta 'read' primeiro para copiar o texto exato do código-fonte.`,
          filesRead: [resolvedPath],
          touchedFiles: [resolvedPath]
        });
      }

      const newContent = content.replace(oldText, newText);
      fs.writeFileSync(resolvedPath, newContent, 'utf8');

      console.log(`   [CommandExecutor] ✅ Arquivo modificado com sucesso`);

      return this.buildResult(true, {
        output: `Substituição realizada com sucesso no arquivo ${resolvedPath}.`,
        filesRead: [resolvedPath],
        filesWritten: [resolvedPath],
        modifiedFiles: [resolvedPath],
        touchedFiles: [resolvedPath]
      });
    } catch (error) {
      return this.buildResult(false, {
        error: `Erro ao editar: ${error.message}`,
        output: `Erro ao editar: ${error.message}`
      });
    }
  }
}

module.exports = CommandExecutor;

