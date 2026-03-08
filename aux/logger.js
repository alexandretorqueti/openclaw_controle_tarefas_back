// aux/logger.js

const fs = require('fs');
const { LOG_FILE } = require('./config');

// Nova regra: Limite fixo de 500 linhas
const MAX_LOG_LINES = 80; 

async function log(message) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const newLine = `[${timestamp}] ${message}`;
  
  // Usa error para manter o stdout limpo para o JSON do OpenClaw ler
  console.error(newLine); 
  
  try {
    let lines = [];

    // helper que substitui o antigo fs.promises.exists
    async function fileExists(path) {
      try {
        await fs.promises.access(path, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    }

    // 1. Lê o arquivo atual (se existir) e transforma em um array de linhas
    if (await fileExists(LOG_FILE)) {
      const currentContent = await fs.promises.readFile(LOG_FILE, 'utf8');
      lines = currentContent.split('\n').filter(l => l.trim() !== '');
    }

    // 2. Lógica "De trás pra frente": Adiciona a nova linha no TOPO do array (índice 0)
    lines.unshift(newLine);
    
    // 3. Apaga o que passar de 500 linhas (mantém apenas do índice 0 ao 499)
    if (lines.length > MAX_LOG_LINES) {
      lines = lines.slice(0, MAX_LOG_LINES);
    }
    
    // 4. Salva de volta no arquivo
    await fs.promises.writeFile(LOG_FILE, lines.join('\n') + '\n');
    
  } catch (e) { 
    console.error(`Erro crítico no logger: ${e.message}`); 
  }
}

module.exports = { log };

