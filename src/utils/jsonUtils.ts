// Migrado para TypeScript - Fase: Utils
// Arquivo: jsonUtils.js

// src/utils/jsonUtils.js
// Utilitarios para manipulacao de JSON

/**
 * Extrai objetos ou arrays JSON de uma string de texto.
 * Melhora a lógica original para suportar arrays e parsing automático.
 */
function extractJsonObjects(text: any): any {
  const results = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  let activeChar = null; // Guarda se estamos rastreando { ou [

  // Mapeamento de pares
  const pairs = { '{': '}', '[': ']' };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      if (inString) escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    // Se não estamos dentro de um JSON, procura início de objeto ou array
    if (depth === 0) {
      if (char === '{' || char === '[') {
        start = i;
        depth = 1;
        activeChar = char;
      }
    } else {
      // Se já estamos dentro, checa se o caractere atual fecha ou abre o nível
      if (char === activeChar) {
        depth++;
      } else if (char === pairs[activeChar]) {
        depth--;
        
        if (depth === 0) {
          const jsonStr = text.substring(start, i + 1);
          try {
            results.push(JSON.parse(jsonStr));
          } catch (e) {
            // Se o JSON extraído for inválido (ex: truncado), ignoramos ou tratamos
            console.error("JSON extraído é inválido:", e.message);
          }
          start = -1;
          activeChar = null;
        }
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
function inspectJsonLikeStructure(text: any): any {
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
function safeParse(jsonString: any, defaultValue = null): any {
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
function safeStringify(value: any, indent = 2): any {
  try {
    return JSON.stringify(value, null, indent);
  } catch (error) {
    return '{}';
  }
}

export {
  extractJsonObjects,
  inspectJsonLikeStructure,
  safeParse,
  safeStringify
};



export default { extractJsonObjects,
  inspectJsonLikeStructure,
  safeParse,
  safeStringify };