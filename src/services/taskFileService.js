// src/services/taskFileService.js
// Servico para gerenciamento de arquivos de tarefas

const fs = require('fs').promises;
const path = require('path');
const { fileExists, safeMoveFile, safeWriteFile, safeUnlink } = require('../utils/fileUtils');
const { formatInlineList, formatNumberedList } = require('../utils/formatUtils');
const TaskAnalysisService = require('./taskAnalysisService');

class TaskFileService {
  /**
   * Gera os caminhos dos arquivos de uma tarefa
   * @param {string} taskId - ID da tarefa
   * @param {string} tasksDir - Diretorio de tarefas
   * @returns {Object}
   */
  static getTaskFilePaths(taskId, tasksDir) {
    return {
      promptFile: path.join(tasksDir, `prompt-${taskId}.txt`),
      relatorioFile: path.join(tasksDir, `relatorio-${taskId}.txt`),
      doneFile: path.join(tasksDir, `done-${taskId}.done`),
      terminalLogFile: path.join(tasksDir, `terminal-${taskId}.log`)
    };
  }

  /**
   * Move arquivos de tarefa para um diretorio de destino
   * @param {string} taskId - ID da tarefa
   * @param {string} sourceDir - Diretorio de origem
   * @param {string} destinationDir - Diretorio de destino
   * @returns {Promise<void>}
   */
  static async moveTaskFiles(taskId, sourceDir, destinationDir) {
    try {
      // Garantir que o diretorio de destino existe
      await fs.mkdir(destinationDir, { recursive: true });
      
      // Listar todos os arquivos no diretorio de origem
      const allFiles = await fs.readdir(sourceDir);
      
      // Move todos os arquivos (exceto monitor-state.json)
      const taskFiles = allFiles.filter(file => file !== 'monitor-state.json');

      console.log(`DEBUG: Movendo ${taskFiles.length} arquivos para ${destinationDir}:`, taskFiles);
      
      for (const file of taskFiles) {
        const src = path.join(sourceDir, file);
        const dest = path.join(destinationDir, file);
        // Verifica se é arquivo (não diretório) e existe
        try {
          const stat = await fs.stat(src);
          if (stat.isFile()) {
            await safeMoveFile(src, dest);
            console.log(`DEBUG: Movido ${file} para ${destinationDir}`);
          }
        } catch (e) {
          // Arquivo não existe mais, ignora
        }
      }
    } catch (error) {
      console.error(`Erro ao mover arquivos da tarefa ${taskId}:`, error);
    }
  }

  /**
   * Prepara arquivos para execucao de uma tarefa
   * @param {Object} task - Tarefa
   * @param {string} tasksDir - Diretorio de tarefas
   * @param {Object} project - Projeto (opcional)
   * @param {Object} analysisPlan - Plano de analise (opcional)
   * @returns {Promise<Object>}
   */
  static async prepareTaskFiles(task, tasksDir, project = null, analysisPlan = null) {
    const taskId = task.id;
    const paths = this.getTaskFilePaths(taskId, tasksDir);

    const resolvedAnalysisPlan = analysisPlan || TaskAnalysisService.analyzeTaskScope(task, project);

    const promptContent = this.generatePromptContent(task, project, resolvedAnalysisPlan, paths);

    await safeWriteFile(paths.promptFile, promptContent);
    await safeWriteFile(paths.relatorioFile, '');
    await safeWriteFile(paths.terminalLogFile, '');

    return {
      ...paths,
      promptContent,
      analysisPlan: resolvedAnalysisPlan
    };
  }

  /**
   * Gera conteudo do prompt para a tarefa
   * @param {Object} task - Tarefa
   * @param {Object} project - Projeto
   * @param {Object} analysisPlan - Plano de analise
   * @param {Object} paths - Caminhos dos arquivos
   * @returns {string}
   */
  static generatePromptContent(task, project, analysisPlan, paths) {
    const personaPrompt = 'Voce e o Agente Tecnico Jarbas.';
    const dirBase = project?.pastaBase || 'Diretorio atual';
    const dirFront = project?.frontendPath || 'Nao definido';
    const dirBack = project?.backendPath || 'Nao definido';

    const architectureMap = `
[ARQUITETURA DO PROJETO]
Voce esta rodando o terminal na pasta base: ${dirBase}
- O codigo do Frontend esta em: ${dirFront}
- O codigo do Backend esta em: ${dirBack}

ATENCAO:
- Nao procure arquivos genericos na raiz sem necessidade.
- Direcione seus comandos 'find', 'grep', 'ls' e 'sed' para as pastas corretas acima.
- Se a tarefa for de desenvolvimento, so finalize depois de alterar os arquivos reais necessarios do projeto.
`;

    const scopeAnalysisBlock = TaskAnalysisService.formatScopeAnalysisBlock(analysisPlan);

    const projectSpecificRules = project?.regras
      ? project.regras
      : 'Nenhuma regra especifica definida.';

    const engineRules = `[REGRA DE OURO - PROIBIDO ADIVINHAR CAMINHOS]
1. Voce NAO PODE adivinhar nomes de arquivos.
2. OBRIGATORIO: Seu primeiro comando deve usar "exec" com 'find', 'ls -la' ou comando equivalente direcionado as pastas da Arquitetura do Projeto.
3. [REGRA ANTI-LOOP]: Se um comando nao retornar nada, E PROIBIDO repeti-lo. Use 'ls -la' ou 'pwd' para se localizar, ou consulte a [ARQUITETURA DO PROJETO] no prompt original.
4. Se a tarefa for de desenvolvimento, relatorio e arquivo .done NAO substituem implementacao real.
   4.1 [PROTOCOLO DE FALHA]: Se o sistema te devolver um erro começando com [ERRO...] ou [FALHA...], VOCÊ ESTÁ PROIBIDO de criar o arquivo .done. Você deve recuar, ler a instrução do erro e tentar uma nova abordagem.
5. Se a tarefa for de analise, o relatorio final deve refletir o que foi realmente inspecionado.
6. Respeite obrigatoriamente a [PRE-ANALISE DE ESCOPO].
7. Se a pre-analise indicar frontend e backend, voce NAO pode concluir a tarefa mexendo em apenas uma das camadas.
8. Antes de concluir, confira se todos os itens da Definicao de pronto foram realmente atendidos.
9. E PROIBIDO usar o arquivo .done para "forcar" conclusao.
10. Voce NAO DEVE apagar e recriar o .done em loop. Crie o .done apenas uma vez, no final, quando tudo estiver realmente concluido.


[COMO USAR FERRAMENTAS]
Emita UM JSON estrito em uma nova linha com o formato:
{"name": "nome_da_ferramenta", "arguments": {"parametro": "valor"}}

### DICAS DE SOBREVIVENCIA NO TERMINAL (MUITO IMPORTANTE) ###
1. ARQUIVOS GRANDES: Se voce tentar usar "read" e receber o aviso de que o arquivo foi cortado por ser muito grande, NAO tente ler de novo. Use a ferramenta "exec" com o comando [sed -n 'LINHA_INICIAL,LINHA_FINALp' /caminho/do/arquivo] para ler apenas as linhas ao redor de onde voce precisa alterar.
2. EDICAO PRECISA: A ferramenta "edit" exige que o 'oldText' seja uma copia EXATA (com espacos e quebras de linha). Se o "edit" falhar varias vezes, use a ferramenta "exec" com o comando [sed -i 's/texto_velho/texto_novo/g' /caminho/do/arquivo] para forcar a substituicao direto no shell.
3. Se voce usar "exec" para alterar arquivos, essas alteracoes DEVEM ser reais e consistentes com a tarefa. Nao altere apenas o relatorio ou o .done.
4. PAYLOADS GRANDES: NAO reescreva arquivos grandes inteiros com "write". Prefira "read" seguido de "edit" em blocos pequenos e exatos.
5. Se precisar alterar muitas regioes, faca multiplos "edit" menores.
6. Evite "exec" gigantes com heredoc para reescrever arquivos grandes, porque a resposta pode ser truncada antes da execucao.

Ferramentas disponiveis:
- {"name": "exec", "arguments": {"command": "comando_shell"}}
- {"name": "read", "arguments": {"file_path": "/caminho"}}
- {"name": "write", "arguments": {"file_path": "/caminho", "content": "conteudo"}}
- {"name": "edit", "arguments": {"file_path": "/caminho", "oldText": "exato_velho", "newText": "novo"}}

QUANDO TERMINAR A TAREFA:
1. Use "write" no arquivo EXATO: ${paths.relatorioFile}
2. Use "exec" com o comando EXATO: touch ${paths.doneFile}
[ALERTA CRÍTICO]: É ESTRITAMENTE PROIBIDO inventar, alterar ou customizar os nomes dos arquivos acima. Se você criar algo como "done-finalizado.done", o sistema NÃO vai reconhecer e você falhará a tarefa. Copie e cole os caminhos exatos informados.`;

    return `${personaPrompt}
OBJETIVO: ${task.title}
DESCRICAO: ${task.description}

${architectureMap}

${scopeAnalysisBlock}

REGRAS:
${projectSpecificRules}

${engineRules}`;
  }

  /**
   * Limpa arquivos de tarefa processada
   * @param {Object} files - Objeto com caminhos dos arquivos
   * @returns {Promise<void>}
   */
  static async cleanupFiles(files) {
    if (!files || !files.promptFile) return;

    try {
      const baseDir = path.dirname(files.promptFile);
      const processedDir = path.join(baseDir, 'processed');
      await fs.mkdir(processedDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // === LISTA ATUALIZADA ===
      const filesToMove = [
        files.promptFile, 
        files.relatorioFile, 
        files.doneFile, 
        files.terminalLogFile,
        files.architectPlanFile, // Arquivo de texto do plano
        files.architectLogFile   // Log do terminal do Arquiteto
      ].filter(Boolean); // Evita falhas se a chave vier undefined

      for (const file of filesToMove) {
        try {
          // O fs.access vai falhar (e cair no catch silencioso) 
          // caso a tarefa não seja de desenvolvimento e o arquivo não exista. Isso é perfeito!
          await fs.access(file);

          const fileName = path.basename(file);
          const ext = path.extname(fileName);
          const nameWithoutExt = path.basename(fileName, ext);
          const newFileName = `${nameWithoutExt}_${timestamp}${ext}`;

          await fs.rename(file, path.join(processedDir, newFileName));
        } catch (error) {
          // Silenciosamente ignora erros ao mover arquivos (exceto ENOENT)
        }
      }
    } catch (error) {
      // Silenciosamente ignora erros ao mover arquivos
    }
  }
}

module.exports = TaskFileService;

