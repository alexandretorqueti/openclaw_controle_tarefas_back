// services/commandExecutor.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

class CommandExecutor {
  /**
   * Executa a ferramenta baseada no JSON extraído do output da IA
   * @param {Object} toolCall - Ex: { name: 'exec', arguments: { command: '...' } }
   * @param {string} cwd - Diretório de trabalho do projeto
   * @returns {Object}
   */
  static async executeTool(toolCall, cwd = process.cwd()) {
    const name = toolCall?.name;
    const args = toolCall?.arguments || {};

    if (!name) {
      return this.buildResult(false, {
        error: "Ferramenta inválida: campo 'name' ausente."
      });
    }

    console.log(`\n   [CommandExecutor] 🤖 Acionando ferramenta: [${String(name).toUpperCase()}]`);

    try {
      switch (name) {
        case 'exec':
          return await this.executeExecWithRealMutationCheck(args.command, cwd);

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
      success: !!success,
      output: data.output || '',
      error: data.error || null,
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      exitCode: data.exitCode ?? null,
      filesRead: uniquePaths(data.filesRead || []),
      filesWritten: uniquePaths(data.filesWritten || []),
      modifiedFiles: uniquePaths(data.modifiedFiles || []),
      touchedFiles: uniquePaths(data.touchedFiles || []),
      commandsExecuted: Array.isArray(data.commandsExecuted) ? data.commandsExecuted.filter(Boolean) : [],
      executionDiagnostics: data.executionDiagnostics || null
    };
  }

  static resolveFilePath(filePath, cwd) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Caminho de arquivo inválido.');
    }

    return path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(cwd, filePath);
  }

  static truncateOutput(text, max = 20000) {
    const value = String(text || '');
    if (value.length <= max) return value;
    return `${value.slice(0, max)}\n...[OUTPUT TRUNCADO]`;
  }

  static async executeExecWithRealMutationCheck(command, cwd = process.cwd()) {
    if (!command || typeof command !== 'string' || !command.trim()) {
      return this.buildResult(false, {
        error: "Parâmetro 'command' ausente."
      });
    }

    console.log(
      `   [CommandExecutor] 🖥️  Terminal: ${command.substring(0, 120)}${command.length > 120 ? '...' : ''}`
    );

    const candidateFiles = extractMutationCandidateFiles(command, cwd);
    const isMutationAttempt = looksLikeMutationCommand(command) && candidateFiles.length > 0;

    const before = isMutationAttempt
      ? await collectFingerprints(candidateFiles)
      : {};

    const shellResult = await runShellCommand(command, {
      cwd,
      timeout: 240000,
      maxBuffer: 20 * 1024 * 1024
    });

    const after = isMutationAttempt
      ? await collectFingerprints(candidateFiles)
      : {};

    const actuallyModifiedFiles = isMutationAttempt
      ? diffFingerprints(before, after)
      : [];

    const noOpMutation =
      shellResult.success &&
      isMutationAttempt &&
      actuallyModifiedFiles.length === 0;

    const outputParts = [];
    if (String(shellResult.stdout || '').trim()) outputParts.push(String(shellResult.stdout).trim());
    if (String(shellResult.stderr || '').trim()) outputParts.push(String(shellResult.stderr).trim());

    if (noOpMutation) {
      outputParts.push(
        'Comando executou com exit code 0, mas não alterou de fato nenhum arquivo-alvo.'
      );
    }

    const success = shellResult.success && !noOpMutation;

    let finalOutput = outputParts.join('\n');
    if (!finalOutput) {
      finalOutput = success
        ? 'Comando executado sem retorno visual (sucesso).'
        : (shellResult.errorMessage || 'Comando falhou sem saída detalhada.');
    }

    let finalError = null;
    if (!success) {
      if (noOpMutation) {
        finalError = 'Comando mutante executou sem erro, mas não alterou nenhum arquivo real.';
      } else {
        const errorParts = [];
        if (shellResult.errorMessage) errorParts.push(shellResult.errorMessage);
        if (String(shellResult.stderr || '').trim()) errorParts.push(String(shellResult.stderr).trim());
        if (!errorParts.length && String(shellResult.stdout || '').trim()) {
          errorParts.push(String(shellResult.stdout).trim());
        }
        finalError = errorParts.join('\n') || 'Comando falhou sem detalhe adicional.';
      }
    }

    console.log(
      success
        ? `   [CommandExecutor] ✅ Exec concluído`
        : `   [CommandExecutor] ❌ Exec falhou${noOpMutation ? ' (sem mutação real)' : ''}`
    );

    return this.buildResult(success, {
      output: this.truncateOutput(finalOutput),
      error: finalError ? this.truncateOutput(finalError) : null,
      stdout: shellResult.stdout || '',
      stderr: shellResult.stderr || '',
      exitCode: shellResult.exitCode,
      filesRead: [],
      filesWritten: actuallyModifiedFiles,
      modifiedFiles: actuallyModifiedFiles,
      touchedFiles: actuallyModifiedFiles,
      commandsExecuted: [command],
      executionDiagnostics: {
        commandType: 'exec',
        isMutationAttempt,
        candidateFiles: uniquePaths(candidateFiles),
        actuallyModifiedFiles: uniquePaths(actuallyModifiedFiles),
        noOpMutation,
        shellExitCode: shellResult.exitCode
      }
    });
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
      const normalizedContent = typeof content === 'string' ? content : String(content ?? '');

      console.log(`   [CommandExecutor] 📝 Escrevendo/Criando: ${path.basename(resolvedPath)}`);

      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const before = fingerprintFileSync(resolvedPath);

      let previousContent = null;
      if (before.exists && before.type === 'file') {
        previousContent = fs.readFileSync(resolvedPath, 'utf8');
      }

      if (previousContent !== null && previousContent === normalizedContent) {
        console.log(`   [CommandExecutor] ℹ️ Conteúdo já era idêntico, sem alteração real`);

        return this.buildResult(true, {
          output: `O arquivo ${resolvedPath} já estava com o conteúdo solicitado. Nenhuma alteração real foi necessária.`,
          filesRead: [resolvedPath],
          touchedFiles: [resolvedPath],
          executionDiagnostics: {
            commandType: 'write',
            noRealChange: true
          }
        });
      }

      fs.writeFileSync(resolvedPath, normalizedContent, 'utf8');

      const after = fingerprintFileSync(resolvedPath);
      const changed = didFingerprintChange(before, after);

      console.log(
        changed
          ? `   [CommandExecutor] ✅ Arquivo salvo com alteração real`
          : `   [CommandExecutor] ℹ️ Arquivo salvo, mas sem alteração detectável`
      );

      return this.buildResult(true, {
        output: changed
          ? `Arquivo ${resolvedPath} criado/sobrescrito com sucesso.`
          : `Arquivo ${resolvedPath} salvo, porém sem alteração detectável no conteúdo.`,
        filesRead: before.exists ? [resolvedPath] : [],
        filesWritten: changed ? [resolvedPath] : [],
        modifiedFiles: changed ? [resolvedPath] : [],
        touchedFiles: [resolvedPath],
        executionDiagnostics: {
          commandType: 'write',
          noRealChange: !changed
        }
      });
    } catch (error) {
      return this.buildResult(false, {
        error: `Erro de escrita: ${error.message}`,
        output: `Erro de escrita: ${error.message}`
      });
    }
  }

  static executeEditCommand(filePath, oldText, newText, cwd) {
    if (!filePath || typeof oldText !== 'string' || oldText.length === 0 || newText === undefined) {
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
        console.log(`   [CommandExecutor] ⚠️ 'oldText' não encontrado no arquivo`);

        return this.buildResult(false, {
          error: "O texto exato fornecido em 'oldText' não foi encontrado no arquivo. Use a ferramenta 'read' primeiro para copiar o trecho exato do código-fonte.",
          output: "O texto exato fornecido em 'oldText' não foi encontrado no arquivo. Use a ferramenta 'read' primeiro para copiar o trecho exato do código-fonte.",
          filesRead: [resolvedPath],
          touchedFiles: [resolvedPath]
        });
      }

      const normalizedNewText = typeof newText === 'string' ? newText : String(newText ?? '');

      if (oldText === normalizedNewText) {
        console.log(`   [CommandExecutor] ℹ️ oldText e newText são idênticos`);

        return this.buildResult(false, {
          error: 'A operação de edit não produziria alteração real porque oldText e newText são idênticos.',
          output: 'A operação de edit não produziria alteração real porque oldText e newText são idênticos.',
          filesRead: [resolvedPath],
          touchedFiles: [resolvedPath],
          executionDiagnostics: {
            commandType: 'edit',
            noRealChange: true
          }
        });
      }

      const before = fingerprintFileSync(resolvedPath);
      const newContent = content.replace(oldText, normalizedNewText);

      if (newContent === content) {
        console.log(`   [CommandExecutor] ℹ️ A substituição não gerou mudança real`);

        return this.buildResult(false, {
          error: 'A substituição foi avaliada, mas não gerou alteração real no conteúdo do arquivo.',
          output: 'A substituição foi avaliada, mas não gerou alteração real no conteúdo do arquivo.',
          filesRead: [resolvedPath],
          touchedFiles: [resolvedPath],
          executionDiagnostics: {
            commandType: 'edit',
            noRealChange: true
          }
        });
      }

      fs.writeFileSync(resolvedPath, newContent, 'utf8');

      const after = fingerprintFileSync(resolvedPath);
      const changed = didFingerprintChange(before, after);

      if (!changed) {
        console.log(`   [CommandExecutor] ℹ️ Escrita concluída, mas sem alteração detectável`);

        return this.buildResult(false, {
          error: 'A edição foi executada, mas nenhuma alteração real foi detectada no arquivo.',
          output: 'A edição foi executada, mas nenhuma alteração real foi detectada no arquivo.',
          filesRead: [resolvedPath],
          touchedFiles: [resolvedPath],
          executionDiagnostics: {
            commandType: 'edit',
            noRealChange: true
          }
        });
      }

      console.log(`   [CommandExecutor] ✅ Arquivo modificado com sucesso`);

      return this.buildResult(true, {
        output: `Substituição realizada com sucesso no arquivo ${resolvedPath}.`,
        filesRead: [resolvedPath],
        filesWritten: [resolvedPath],
        modifiedFiles: [resolvedPath],
        touchedFiles: [resolvedPath],
        executionDiagnostics: {
          commandType: 'edit',
          noRealChange: false
        }
      });
    } catch (error) {
      return this.buildResult(false, {
        error: `Erro ao editar: ${error.message}`,
        output: `Erro ao editar: ${error.message}`
      });
    }
  }
}

function unique(values = []) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function uniquePaths(values = []) {
  return Array.from(
    new Set(
      (values || [])
        .filter(Boolean)
        .map((value) => path.resolve(String(value)))
    )
  );
}

function shellSplit(input = '') {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function looksLikeMutationCommand(command = '') {
  const compact = String(command || '').trim();

  return (
    /\bsed\s+-i(\S*)?\b/.test(compact) ||
    /\bperl\s+-[^\n]*i/.test(compact) ||
    /^\s*touch\b/.test(compact) ||
    /^\s*rm\b/.test(compact) ||
    /^\s*cp\b/.test(compact) ||
    /^\s*mv\b/.test(compact) ||
    /\btee\b/.test(compact) ||
    /(^|[^0-9])>>?\s*["'`]?[^"'`\s|;&]+["'`]?/.test(compact)
  );
}

function extractMutationCandidateFiles(command = '', cwd = process.cwd()) {
  const tokens = shellSplit(command);
  if (!tokens.length) return [];

  const executable = path.basename(tokens[0]);
  const candidates = [];

  if (executable === 'sed' && tokens.some((t) => t === '-i' || /^-i/.test(t))) {
    let i = 1;

    while (i < tokens.length && tokens[i].startsWith('-')) {
      i += 1;
    }

    if (i < tokens.length) {
      i += 1; // pula o script do sed
    }

    candidates.push(
      ...tokens
        .slice(i)
        .filter((t) => t && !t.startsWith('-'))
        .map((t) => path.resolve(cwd, t))
    );
  }

  if (executable === 'perl' && tokens.some((t) => /^-.*i/.test(t))) {
    let i = 1;

    while (i < tokens.length && tokens[i].startsWith('-')) {
      i += 1;
    }

    if (i < tokens.length) {
      i += 1; // pula o script perl
    }

    candidates.push(
      ...tokens
        .slice(i)
        .filter((t) => t && !t.startsWith('-'))
        .map((t) => path.resolve(cwd, t))
    );
  }

  if (executable === 'touch' || executable === 'rm') {
    candidates.push(
      ...tokens
        .slice(1)
        .filter((t) => t && !t.startsWith('-'))
        .map((t) => path.resolve(cwd, t))
    );
  }

  if (executable === 'cp' || executable === 'mv') {
    const nonOptionArgs = tokens.slice(1).filter((t) => t && !t.startsWith('-'));
    if (nonOptionArgs.length > 0) {
      candidates.push(path.resolve(cwd, nonOptionArgs[nonOptionArgs.length - 1]));
    }
  }

  if (executable === 'tee') {
    candidates.push(
      ...tokens
        .slice(1)
        .filter((t) => t && !t.startsWith('-'))
        .map((t) => path.resolve(cwd, t))
    );
  }

  candidates.push(...extractRedirectionTargets(command, cwd));

  return uniquePaths(candidates);
}

function extractRedirectionTargets(command = '', cwd = process.cwd()) {
  const targets = [];
  const regex = /(^|[^0-9])>>?\s*(["'`])?([^"'`\s|;&]+)\2?/g;

  let match;
  while ((match = regex.exec(command)) !== null) {
    const rawTarget = (match[3] || '').trim();
    if (!rawTarget) continue;
    targets.push(path.resolve(cwd, rawTarget));
  }

  return uniquePaths(targets);
}

async function fingerprintFile(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);

    if (!stat.isFile()) {
      return {
        exists: true,
        type: 'non-file',
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        hash: null
      };
    }

    const content = await fs.promises.readFile(filePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      exists: true,
      type: 'file',
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { exists: false };
    }

    return {
      exists: false,
      error: error.message
    };
  }
}

function fingerprintFileSync(filePath) {
  try {
    const stat = fs.statSync(filePath);

    if (!stat.isFile()) {
      return {
        exists: true,
        type: 'non-file',
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        hash: null
      };
    }

    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      exists: true,
      type: 'file',
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { exists: false };
    }

    return {
      exists: false,
      error: error.message
    };
  }
}

async function collectFingerprints(files = []) {
  const result = {};

  for (const file of uniquePaths(files)) {
    result[file] = await fingerprintFile(file);
  }

  return result;
}

function didFingerprintChange(before = {}, after = {}) {
  return diffFingerprints({ file: before }, { file: after }).length > 0;
}

function diffFingerprints(before = {}, after = {}) {
  const allFiles = unique([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];

  for (const file of allFiles) {
    const prev = before[file] || { exists: false };
    const next = after[file] || { exists: false };

    const existenceChanged = prev.exists !== next.exists;
    const typeChanged = prev.type !== next.type;
    const sizeChanged = prev.size !== next.size;
    const hashChanged = prev.hash !== next.hash;

    if (existenceChanged || typeChanged || sizeChanged || hashChanged) {
      changed.push(file);
    }
  }

  return uniquePaths(changed);
}

function runShellCommand(command, options = {}) {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: options.cwd || process.cwd(),
        timeout: options.timeout ?? 120000,
        maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
        shell: '/bin/bash'
      },
      (error, stdout = '', stderr = '') => {
        const exitCode =
          typeof error?.code === 'number'
            ? error.code
            : error
              ? 1
              : 0;

        resolve({
          success: !error,
          exitCode,
          stdout,
          stderr,
          errorMessage: error?.message || null
        });
      }
    );
  });
}

module.exports = CommandExecutor;