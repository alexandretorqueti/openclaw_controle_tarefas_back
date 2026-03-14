// src/services/contractVerificationService.js
// Servico para verificacao de contratos de tarefas

const fs = require('fs').promises;
const path = require('path');
const { resolveProjectPath, isPathInside } = require('../utils/pathUtils');
const { isInspectionCommand, commandTargetsOnlySpecialFiles, isMeaningfulCommand } = require('../utils/commandUtils');
const TaskAnalysisService = require('./taskAnalysisService');
const WorkspaceSnapshotService = require('./workspaceSnapshotService'); // <-- Nova importação

class ContractVerificationService {
  /**
   * Verifica se o contrato da tarefa foi cumprido
   * @param {string} doneFile - Caminho do arquivo .done
   * @param {string} relatorioFile - Caminho do arquivo de relatorio
   * @param {string} terminalLogFile - Caminho do log de terminal
   * @param {Object} options - Opcoes de verificacao
   * @returns {Promise<Object>}
   */
  static async verifyContract(doneFile, relatorioFile, terminalLogFile, options = {}) {
    try {
      const doneExists = await fs.access(doneFile).then(() => true).catch(() => false);
      const relatorioExists = await fs.access(relatorioFile).then(() => true).catch(() => false);

      let executionNotes = '';
      let relatorioValido = false;

      if (relatorioExists) {
        try {
          const relatorioContent = await fs.readFile(relatorioFile, 'utf8');
          if (relatorioContent.trim().length > 20) {
            executionNotes = relatorioContent.trim();
            relatorioValido = true;
          }
        } catch (_) {}
      }

      // Verificacao simples quando nao ha opcoes
      if (!options || Object.keys(options).length === 0) {
        if (doneExists || relatorioValido) {
          return {
            contractFulfilled: true,
            executionNotes: executionNotes || 'Concluido via Orquestrador'
          };
        }

        return {
          contractFulfilled: false,
          executionNotes: 'Contrato nao cumprido.'
        };
      }

      const {
        taskType = 'automation',
        task = {},
        evidence = {},
        project = null,
        analysisPlan = null,
        initialSnapshot = null // <-- Recebe o snapshot injetado pelo orquestrador
      } = options;

      const resolvedAnalysisPlan = analysisPlan || TaskAnalysisService.analyzeTaskScope(task, project);

      // === A NOVA FONTE DA VERDADE (FILE SYSTEM) ===
      let realModifiedFiles = [];
      
      if (initialSnapshot && project?.pastaBase) {
        // Pegamos TUDO que mudou na pasta do projeto
        const allChangedInDisk = await WorkspaceSnapshotService.getModifiedFiles(initialSnapshot, project.pastaBase);

        // FILTRO REAL: Aceita qualquer alteração, EXCETO os arquivos do orquestrador
        realModifiedFiles = allChangedInDisk.filter(filePath => {
          const resolvedPath = path.resolve(filePath);
          const fileName = path.basename(resolvedPath);

          // 1. Ignora os 3 arquivos de controle exatos desta execução
          if (
              resolvedPath === path.resolve(doneFile) ||
              resolvedPath === path.resolve(relatorioFile) ||
              resolvedPath === path.resolve(terminalLogFile)
          ) {
              return false;
          }

          // 2. Ignora qualquer arquivo de sistema gerado por NÓS (Arquiteto, Prompts, etc)
          if (/^(prompt|relatorio|terminal|done|plano-arquiteto|terminal-arquiteto)-.*\.(txt|log|done)$/i.test(fileName)) {
              return false;
          }

          // Se passou pelos filtros acima, é um código-fonte/arquivo real do seu projeto!
          return true;
        });
        
      } else {
         // Fallback de segurança caso o snapshot falhe ou não seja passado
         const modifiedFiles = Array.from(evidence.modifiedFiles || []);
         const filesWritten = Array.from(evidence.filesWritten || []);
         realModifiedFiles = [...new Set([...modifiedFiles, ...filesWritten])].filter(
            (file) => file !== relatorioFile && file !== doneFile && file !== terminalLogFile
         );
      }

      // O Snapshot não detecta leituras/inspeções, então mantemos a captura delas via evidência
      const filesRead = Array.from(evidence.filesRead || []);
      const touchedFiles = Array.from(evidence.touchedFiles || []);
      const commandsExecuted = Array.from(evidence.commandsExecuted || []);

      const specialArtifacts = [relatorioFile, doneFile, terminalLogFile]
        .filter(Boolean)
        .map((file) => path.resolve(file));

      const isOnlySpecialCommand = (cmd) =>
        commandTargetsOnlySpecialFiles(
          cmd,
          specialArtifacts,
          project?.pastaBase || process.cwd()
        );

      // Os arquivos realmente "tocados" agora englobam o que foi modificado pelo File System e lido pela IA
      const realTouchedFiles = Array.from(
        new Set([...filesRead, ...touchedFiles, ...realModifiedFiles])
      ).filter((file) => file && file !== relatorioFile && file !== doneFile && file !== terminalLogFile);

      const inspectionCommands = commandsExecuted.filter((cmd) =>
        isInspectionCommand(cmd || '') && !isOnlySpecialCommand(cmd)
      );

      const meaningfulCommands = commandsExecuted.filter((cmd) => {
        if (!cmd || typeof cmd !== 'string') return false;
        return isMeaningfulCommand(cmd, specialArtifacts, project?.pastaBase || process.cwd());
      });

      // === DEFINIÇÃO DOS CAMINHOS DAS CAMADAS ===
      const fullFrontendPath = resolveProjectPath(project?.pastaBase, project?.frontendPath);
      const fullBackendPath = resolveProjectPath(project?.pastaBase, project?.backendPath);

      // Funções blindadas para verificar se um arquivo pertence a uma camada
      // Tenta usar o isPathInside, mas se falhar por diferença de path absoluto/relativo,
      // usa o .includes() com o nome da pasta (ex: 'tarefas-server') como garantia.
      const isFrontendFile = (file) => {
          if (!file) return false;
          const normalized = file.replace(/\\/g, '/'); // Previne erros de barra no Windows/Linux
          if (fullFrontendPath && isPathInside(normalized, fullFrontendPath)) return true;
          if (project?.frontendPath && normalized.includes(project.frontendPath)) return true;
          return false;
      };

      const isBackendFile = (file) => {
          if (!file) return false;
          const normalized = file.replace(/\\/g, '/');
          if (fullBackendPath && isPathInside(normalized, fullBackendPath)) return true;
          if (project?.backendPath && normalized.includes(project.backendPath)) return true;
          return false;
      };

      // Agora a checagem das camadas usa as funções blindadas
      const modifiedInFrontend = realModifiedFiles.filter(isFrontendFile);
      const modifiedInBackend = realModifiedFiles.filter(isBackendFile);

      const touchedInFrontend = realTouchedFiles.filter(isFrontendFile);
      const touchedInBackend = realTouchedFiles.filter(isBackendFile);

      const reportRequired =
        TaskAnalysisService.requiresReport(task) ||
        taskType === 'analysis' ||
        taskType === 'development';

      // VERIFICACAO PARA ANALISE
      if (taskType === 'analysis') {
        if (!relatorioValido) {
          return {
            contractFulfilled: false,
            executionNotes: 'Aguardando relatorio valido.',
            feedbackToAgent:
              '[VALIDACAO] Esta e uma tarefa de analise/documentacao. Gere um relatorio final consistente no arquivo de relatorio antes de concluir.'
          };
        }

        if (!doneExists) {
          return {
            contractFulfilled: false,
            executionNotes: 'Aguardando arquivo .done.',
            feedbackToAgent:
              '[VALIDACAO] Gere o relatorio e finalize criando o arquivo .done obrigatorio.'
          };
        }

        const haEvidenciaInspecao =
          realTouchedFiles.length > 0 || inspectionCommands.length > 0;

        if (!haEvidenciaInspecao) {
          return {
            contractFulfilled: false,
            executionNotes: 'Sem evidencia de inspecao.',
            feedbackToAgent:
              '[VALIDAÇÃO DE ANÁLISE FALHOU] Você gerou um relatório final, mas os logs mostram que você NÃO INSPECIONOU nenhum arquivo do projeto. Não alucine o relatório. AÇÃO OBRIGATÓRIA: Use as ferramentas "exec" (com ls, grep) ou "read" para investigar os arquivos reais do projeto antes de reescrever o relatório e concluir.'
          };
        }

        return {
          contractFulfilled: true,
          executionNotes: executionNotes || 'Tarefa de analise concluida.'
        };
      }

      // VERIFICACAO PARA DESENVOLVIMENTO
      if (taskType === 'development') {
        if (!relatorioValido) {
          return {
            contractFulfilled: false,
            executionNotes: 'Aguardando relatorio valido.',
            feedbackToAgent:
              '[VALIDACAO] Esta e uma tarefa de desenvolvimento. Gere um relatorio final valido no arquivo de relatorio.'
          };
        }

        if (!doneExists) {
          return {
            contractFulfilled: false,
            executionNotes: 'Aguardando arquivo .done.',
            feedbackToAgent:
              '[VALIDACAO] Apos implementar as alteracoes, crie o arquivo .done obrigatorio.'
          };
        }

        if (realModifiedFiles.length === 0) {
          return {
            contractFulfilled: false,
            executionNotes: 'Nenhuma alteracao real detectada.',
            feedbackToAgent:
              '[FALHA DE VALIDAÇÃO CRÍTICA] Você tentou finalizar a tarefa, mas NENHUM arquivo do código-fonte foi modificado no disco. A sua última tentativa de alteração falhou ou foi ignorada pelo sistema. PARE de tentar concluir. PASSO A PASSO OBRIGATÓRIO AGORA: 1. Use a ferramenta "read" para ler o arquivo que você precisa alterar. 2. Use a ferramenta "edit" (ou "write") para injetar o código correto. 3. SÓ crie o .done depois de ter uma confirmação de sucesso na edição.'
          };
        }

        // Verifica camadas obrigatorias
        for (const layer of resolvedAnalysisPlan.requiredModifiedLayers || []) {
          if (layer === 'frontend' && fullFrontendPath && modifiedInFrontend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'Pre-analise exige alteracao no frontend, mas nenhuma foi detectada.',
              feedbackToAgent:
              `[FALHA DE ARQUITETURA] A análise exige alteração REAL no Frontend, mas você só alterou arquivos de outras pastas. Você ainda não tocou em: ${project?.frontendPath || fullFrontendPath}. PROIBIDO concluir a tarefa agora. Vá até essa pasta, faça as alterações necessárias nas telas/componentes, e recrie o .done.`            };
          }

          if (layer === 'backend' && fullBackendPath && modifiedInBackend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'Pre-analise exige alteracao no backend, mas nenhuma foi detectada.',
              feedbackToAgent:
                `[FALHA DE ARQUITETURA] A análise exige alteração REAL no Backend, mas você só alterou arquivos de outras pastas. Você ainda não tocou em: ${project?.backendPath || fullBackendPath}. PROIBIDO concluir a tarefa agora. Vá até essa pasta, faça as implementações necessárias, e recrie o .done.`
            };
          }
        }

        // Verifica camadas esperadas
        for (const layer of resolvedAnalysisPlan.expectedLayers || []) {
          if (resolvedAnalysisPlan.requiredModifiedLayers?.includes(layer)) {
            continue;
          }

          if (layer === 'frontend' && fullFrontendPath && touchedInFrontend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'A pre-analise esperava revisao do frontend, mas nao ha evidencia disso.',
              feedbackToAgent:
                `[VALIDACAO] A pre-analise indicou impacto potencial no frontend. Ainda nao ha evidencia de inspecao em ${project?.frontendPath || fullFrontendPath}. Revise essa camada antes de concluir.`
            };
          }

          if (layer === 'backend' && fullBackendPath && touchedInBackend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'A pre-analise esperava revisao do backend, mas nao ha evidencia disso.',
              feedbackToAgent:
                `[VALIDACAO] A pre-analise indicou impacto potencial no backend. Ainda nao ha evidencia de inspecao em ${project?.backendPath || fullBackendPath}. Revise essa camada antes de concluir.`
            };
          }
        }

        return {
          contractFulfilled: true,
          executionNotes: executionNotes || 'Tarefa de desenvolvimento concluida.'
        };
      }

      // VERIFICACAO PARA AUTOMACAO
      if (reportRequired && !relatorioValido) {
        return {
          contractFulfilled: false,
          executionNotes: 'Aguardando relatorio valido.',
          feedbackToAgent:
            '[VALIDACAO] Esta tarefa exige relatorio final. Escreva o resultado no arquivo de relatorio antes de concluir.'
        };
      }

      if (!doneExists) {
        return {
          contractFulfilled: false,
          executionNotes: 'Aguardando arquivo .done.',
          feedbackToAgent:
            '[VALIDACAO] Finalize a tarefa criando o arquivo .done obrigatorio.'
        };
      }

      const usefulExecution =
        realModifiedFiles.length > 0 ||
        realTouchedFiles.length > 0 ||
        meaningfulCommands.length > 0;

      if (!usefulExecution) {
        return {
          contractFulfilled: false,
          executionNotes: 'Sem evidencia de execucao util.',
          feedbackToAgent:
            '[VALIDACAO] Ainda nao ha evidencia de execucao util. Execute as acoes necessarias antes de concluir.'
        };
      }

      return {
        contractFulfilled: true,
        executionNotes: executionNotes || 'Tarefa de automacao concluida.'
      };
    } catch (e) {
      return {
        contractFulfilled: false,
        executionNotes: e.message
      };
    }
  }
}

module.exports = ContractVerificationService;