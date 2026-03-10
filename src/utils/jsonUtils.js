// src/utils/jsonUtils.js
// Utilitarios para manipulacao de JSON

/**
 * Extrai objetos JSON de um texto
 * @param {string} text - Texto contendo JSON
 * @returns {string[]}
 */
function extractJsonObjects(text) {
  const results = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      if (inString) {
        escape = true;
      }
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        results.push(text.substring(start, i + 1));
        start = -1;
      }
    }
  }

  return results;
}

/**
 * Inspeciona estrutura de JSON para detectar truncamento
 * @param {string} text - Texto a inspecionar
 * @returns {Object}
 */
function inspectJsonLikeStructure(text) {
  let depth = 0;
  let inString = false;
  let escape = false;
  let sawOpeningBrace = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      sawOpeningBrace = true;
      depth++;
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
    }
  }

  return {
    finalDepth: depth,
    inString,
    sawOpeningBrace
  };
}

/**
 * Faz parse seguro de JSON
 * @param {string} jsonString - String JSON
 * @param {*} defaultValue - Valor padrao se falhar
 * @returns {*}
 */
function safeParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Stringify seguro de JSON
 * @param {*} value - Valor a serializar
 * @param {number} indent - Indentacao (default: 2)
 * @returns {string}
 */
function safeStringify(value, indent = 2) {
  try {
    return JSON.stringify(value, null, indent);
  } catch (error) {
    return '{}';
  }
}

module.exports = {
  extractJsonObjects,
  inspectJsonLikeStructure,
  safeParse,
  safeStringify
};
