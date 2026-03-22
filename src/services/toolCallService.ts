// Migrado para TypeScript - Fase: Services
// Arquivo: toolCallService.js

export // src/services/toolCallService.js
// Servico para parsing e manipulacao de tool calls

import { extractJsonObjects, inspectJsonLikeStructure } from '../utils/jsonUtils';

class ToolCallService {
  static SUPPORTED_TOOLS = ['exec', 'read', 'write', 'edit'];

  /**
   * Normaliza um tool call para formato padrao
   * @param {Object} parsed - Objeto parseado
   * @returns {Object|null}
   */
  static normalizeToolCall(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.name || typeof parsed.name !== 'string') return null;

    const name = parsed.name.trim();

    if (!this.SUPPORTED_TOOLS.includes(name)) {
      return null;
    }

    const args = parsed.arguments && typeof parsed.arguments === 'object'
      ? parsed.arguments
      : {};

    if (name === 'exec') {
      if (!args.command || typeof args.command !== 'string') return null;
      return { name, arguments: { command: args.command } };
    }

    if (name === 'read') {
      const filePath = args.file_path || args.path || args.filePath;
      if (!filePath || typeof filePath !== 'string') return null;
      return { name, arguments: { file_path: filePath } };
    }

    if (name === 'write') {
      const filePath = args.file_path || args.path || args.filePath;
      if (!filePath || typeof filePath !== 'string') return null;

      const content =
        typeof args.content === 'string'
          ? args.content
          : String(args.content ?? '');

      return { name, arguments: { file_path: filePath, content } };
    }

    if (name === 'edit') {
      const filePath = args.file_path || args.path || args.filePath;
      const oldText = args.oldText ?? args.old_text ?? args.oldString;
      const newText = args.newText ?? args.new_text ?? args.newString;

      if (!filePath || typeof filePath !== 'string') return null;
      if (typeof oldText !== 'string') return null;
      if (typeof newText !== 'string') return null;

      return {
        name,
        arguments: {
          file_path: filePath,
          oldText,
          newText
        }
      };
    }

    return null;
  }

  /**
   * Extrai tool call de um texto
   * @param {string} text - Texto contendo tool call
   * @returns {Object|null}
   */
  static extractToolCallFromText(text) {
    if (!text || !text.trim()) return null;

    const candidates = [];

    // Extrai de blocos code fenced
    const fencedBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    for (const match of fencedBlocks) {
      if (match[1] && match[1].trim()) {
        candidates.push(match[1].trim());
      }
    }

    // Extrai objetos JSON diretos
    const jsonObjects = extractJsonObjects(text);
    for (const jsonStr of jsonObjects) {
      candidates.push(jsonStr);
    }

    // Tenta parsear cada candidato
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const normalized = this.normalizeToolCall(parsed);
        if (normalized) return normalized;
      } catch (_) {
        // ignora candidatos invalidos
      }
    }

    return null;
  }

  /**
   * Tenta identificar o nome da ferramenta no texto
   * @param {string} text - Texto a analisar
   * @returns {string|null}
   */
  static getLikelyToolNameFromText(text) {
    if (!text || typeof text !== 'string') return null;

    const directMatch = text.match(/"name"\s*:\s*"(exec|read|write|edit)"/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1].toLowerCase();
    }

    return null;
  }

  /**
   * Detecta tool call truncada
   * @param {string} text - Texto a analisar
   * @returns {Object|null}
   */
  static detectTruncatedToolCall(text) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();
    if (!trimmed) return null;

    // Se conseguimos parsear normalmente, nao esta truncada
    const parsed = this.extractToolCallFromText(trimmed);
    if (parsed) return null;

    const likelyTool = this.getLikelyToolNameFromText(trimmed);
    const mentionsArguments = /"arguments"\s*:/i.test(trimmed);
    const looksLikeToolJson =
      (trimmed.includes('{') && mentionsArguments) ||
      !!likelyTool ||
      /```(?:json)?/i.test(trimmed);

    if (!looksLikeToolJson) {
      return null;
    }

    const structure = inspectJsonLikeStructure(trimmed);

    let reason = 'json_invalido_ou_truncado';

    if (structure.inString) {
      reason = 'string_json_nao_foi_fechada';
    } else if (structure.finalDepth > 0) {
      reason = 'objeto_json_incompleto';
    } else if (likelyTool === 'write' && trimmed.length > 4000) {
      reason = 'payload_grande_demais_ou_truncado';
    } else if (likelyTool === 'exec' && trimmed.length > 4000) {
      reason = 'exec_grande_demais_ou_truncado';
    }

    return {
      detected: true,
      likelyTool: likelyTool || 'desconhecida',
      reason,
      preview: trimmed.substring(0, 700)
    };
  }

  /**
   * Constroi assinatura de turno para deteccao de loop
   * @param {Object} executionResult - Resultado da execucao
   * @returns {string}
   */
  static buildTurnSignature(executionResult) {
    if (executionResult?.toolCall?.name === 'exec') {
      return this.normalizeActionSignature(
        'exec',
        executionResult.toolResult || {},
        executionResult.toolCall?.arguments?.command || ''
      );
    }

    if (executionResult?.toolCall?.name === 'read') {
      return `read:${executionResult.toolCall.arguments?.file_path || ''}`;
    }

    if (executionResult?.toolCall?.name === 'write') {
      return `write:${executionResult.toolCall.arguments?.file_path || ''}`;
    }

    if (executionResult?.toolCall?.name === 'edit') {
      return `edit:${executionResult.toolCall.arguments?.file_path || ''}`;
    }

    if (executionResult?.truncatedToolInfo?.detected) {
      return `truncated:${executionResult.truncatedToolInfo.likelyTool}:${executionResult.truncatedToolInfo.reason}`;
    }

    if (executionResult?.rawOutput) {
      return `raw:${executionResult.rawOutput.trim().replace(/\s+/g, ' ').substring(0, 250)}`;
    }

    return executionResult?.success
      ? 'success_without_action'
      : `error:${executionResult?.errorMessage || 'unknown'}`;
  }

  /**
   * Normaliza assinatura de acao para comparacao
   * @param {string} toolName - Nome da ferramenta
   * @param {Object} toolResult - Resultado da ferramenta
   * @param {string} fallbackCommand - Comando fallback
   * @returns {string}
   */
  static normalizeActionSignature(toolName, toolResult = {}, fallbackCommand = '') {
    import * as path from 'path';
    import { shellSplit } from '../utils/commandUtils';

    if (toolName !== 'exec') {
      return toolName;
    }

    const command = (toolResult.commandsExecuted || [])[0] || fallbackCommand || '';
    const compact = command.replace(/\s+/g, ' ').trim();

    const isLineByLineSed =
      /^\s*sed\b/.test(compact) &&
      /\s-i(\S*)?\s/.test(compact) &&
      /(^|['"\s])\d+c\\?/.test(compact);

    if (isLineByLineSed) {
      const tokens = shellSplit(command);
      const file = tokens[tokens.length - 1]
        ? path.resolve(tokens[tokens.length - 1])
        : 'unknown-file';

      return `exec:sed_line_by_line:${file}`;
    }

    return `exec:${compact.slice(0, 160)}`;
  }

  /**
   * Detecta loop de acoes repetidas
   * @param {string[]} signatures - Array de assinaturas
   * @param {number} maxPatternSize - Tamanho maximo do padrao
   * @param {number} repetitions - Numero de repeticoes
   * @returns {Object}
   */
  static detectRepeatedActionLoop(signatures, maxPatternSize = 12, repetitions = 3) {
    if (!Array.isArray(signatures) || signatures.length < repetitions) {
      return { detected: false };
    }

    const total = signatures.length;
    const maxSize = Math.min(maxPatternSize, Math.floor(total / repetitions));

    for (let patternSize = 1; patternSize <= maxSize; patternSize++) {
      const tail = signatures.slice(total - patternSize);
      if (tail.some((item) => !item)) continue;

      let repeated = true;
      for (let rep = 2; rep <= repetitions; rep++) {
        const start = total - patternSize * rep;
        const candidate = signatures.slice(start, start + patternSize);

        if (candidate.length !== patternSize) {
          repeated = false;
          break;
        }

        if (candidate.join('||') !== tail.join('||')) {
          repeated = false;
          break;
        }
      }

      if (repeated) {
        return {
          detected: true,
          patternSize,
          repetitions,
          pattern: tail
        };
      }
    }

    return { detected: false };
  }
}

export default ToolCallService;
