// src/utils/smartFileFinder.js
const fs = require('fs').promises;
const path = require('path');

class SmartFileFinder {
  // Cria uma pausa milimétrica no Event Loop para o disco respirar
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Procura o verdadeiro arquivo de plano do arquiteto, driblando nomes inventados
   * e arquivos falsos, aguardando a gravação física no disco.
   */
  static async findRealArchitectPlan(expectedPath, taskDir, maxRetries = 3) {
    try {
      await this.sleep(100);
      let realPlanContent = null;
      let actualFilePath = expectedPath;

      for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
        
        // 1. Checa o arquivo oficial primeiro
        const expectedExists = await fs.access(expectedPath).then(() => true).catch(() => false);
        
        if (expectedExists) {
          const content = await fs.readFile(expectedPath, 'utf8');
          if (content.trim().length > 50) {
            return { content, path: expectedPath }; // Achou o oficial e está bom!
          }
          if (tentativa === 1) {
              console.log(`🕵️ [SISTEMA] Arquivo de plano oficial detectado como FALSO ou VAZIO (${content.trim()}). Iniciando varredura...`);
          }
        }

        // 2. Se o oficial falhou ou é mentira, varre a pasta da tarefa
        const files = await fs.readdir(taskDir);
        
        const candidateFiles = files.filter(f => {
          const lower = f.toLowerCase();
          return (lower.startsWith('plano-') || lower.startsWith('plan-') || lower.includes('architect') && (!(lower.includes('prompt')))) 
                 && (lower.endsWith('.txt') || lower.endsWith('.md'));
        });

        // 3. Lê os candidatos para achar o maior/mais provável
        for (const file of candidateFiles) {
          const fullPath = path.join(taskDir, file);
          if (fullPath === expectedPath) continue; 

          const content = await fs.readFile(fullPath, 'utf8');
          
          if (content.trim().length > 100) {
            realPlanContent = content;
            actualFilePath = fullPath;
            console.log(`🎯 [SISTEMA] Verdadeiro plano do Arquiteto encontrado em: ${file}`);
            break; // Quebra o loop dos arquivos
          }
        }

        // 4. Se achou o conteúdo rebelde, corrige, salva e retorna!
        if (realPlanContent && actualFilePath !== expectedPath) {
          console.log(`🧹 [SISTEMA] Copiando conteúdo de ${path.basename(actualFilePath)} para o arquivo oficial.`);
          await fs.writeFile(expectedPath, realPlanContent, 'utf8');
          await fs.unlink(actualFilePath).catch(() => {});
          return { content: realPlanContent, path: expectedPath };
        }

        // Se chegou até aqui e não achou NADA, dá um respiro de 1 segundo para o disco e tenta de novo
        if (tentativa < maxRetries) {
          console.log(`⏳ [SISTEMA] Arquivo do plano ainda não apareceu no disco. Aguardando gravação (Tentativa ${tentativa}/${maxRetries})...`);
          await this.sleep(100); // 1 minuto
        }
      }

      // Se passou das 3 tentativas (4.5 segundos) e não achou, desiste.
      return { content: null, path: expectedPath };

    } catch (error) {
      console.error(`❌ Erro no SmartFileFinder: ${error.message}`);
      return { content: null, path: expectedPath };
    }
  }
}

module.exports = SmartFileFinder;