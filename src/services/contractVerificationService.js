// src/services/contractVerificationService.js
// Servico para verificacao de contratos de tarefas

const fs = require('fs').promises;
const path = require('path');
const { resolveProjectPath, isPathInside } = require('../utils/pathUtils');
const { isInspectionCommand, commandTargetsOnlySpecialFiles, isMeaningfulCommand } = require('../utils/commandUtils');
const TaskAnalysisService = require('./taskAnalysisService');

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
        analysisPlan = null
      } = options;

      const resolvedAnalysisPlan = analysisPlan || TaskAnalysisService.analyzeTaskScope(task, project);

      const filesRead = Array.from(evidence.filesRead || []);
      const filesWritten = Array.from(evidence.filesWritten || []);
      const modifiedFiles = Array.from(evidence.modifiedFiles || []);
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

      const realModifiedFiles = modifiedFiles.filter(
        (file) => file !== relatorioFile && file !== doneFile && file !== terminalLogFile
      );

      const realWrittenFiles = filesWritten.filter(
        (file) => file !== relatorioFile && file !== doneFile && file !== terminalLogFile
      );

      const realTouchedFiles = Array.from(
        new Set(
          [...filesRead, ...filesWritten, ...modifiedFiles, ...touchedFiles]
            .filter((file) => file && file !== relatorioFile && file !== doneFile && file !== terminalLogFile)
        )
      );

      const inspectionCommands = commandsExecuted.filter((cmd) =>
        isInspectionCommand(cmd || '') && !isOnlySpecialCommand(cmd)
      );

      const meaningfulCommands = commandsExecuted.filter((cmd) => {
        if (!cmd || typeof cmd !== 'string') return false;
        return isMeaningfulCommand(cmd, specialArtifacts, project?.pastaBase || process.cwd());
      });

      const fullFrontendPath = resolveProjectPath(project?.pastaBase, project?.frontendPath);
      const fullBackendPath = resolveProjectPath(project?.pastaBase, project?.backendPath);

      const modifiedInFrontend = fullFrontendPath
        ? realModifiedFiles.filter((file) => isPathInside(file, fullFrontendPath))
        : [];

      const modifiedInBackend = fullBackendPath
        ? realModifiedFiles.filter((file) => isPathInside(file, fullBackendPath))
        : [];

      const touchedInFrontend = fullFrontendPath
        ? realTouchedFiles.filter((file) => isPathInside(file, fullFrontendPath))
        : [];

      const touchedInBackend = fullBackendPath
        ? realTouchedFiles.filter((file) => isPathInside(file, fullBackendPath))
        : [];

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
              '[VALIDACAO] Voce gerou saida final, mas ainda nao ha evidencia de inspecao/analise. Leia arquivos ou execute comandos de inspecao reais antes de concluir.'
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
              '[VALIDACAO] Relatorio e .done nao substituem implementacao. Nenhum arquivo real do projeto foi modificado ainda. Se voce alterou usando exec/sed, confirme que a alteracao foi feita no arquivo correto. Volte, localize os arquivos corretos e faca a alteracao necessaria antes de concluir.'
          };
        }

        // Verifica camadas obrigatorias
        for (const layer of resolvedAnalysisPlan.requiredModifiedLayers || []) {
          if (layer === 'frontend' && fullFrontendPath && modifiedInFrontend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'Pre-analise exige alteracao no frontend, mas nenhuma foi detectada.',
              feedbackToAgent:
                `[VALIDACAO] A pre-analise desta tarefa exige alteracao REAL no frontend. Voce ainda nao modificou arquivos em ${project?.frontendPath || fullFrontendPath}. Revise o frontend, altere os formularios/telas necessarios, atualize o relatorio e recrie o .done.`
            };
          }

          if (layer === 'backend' && fullBackendPath && modifiedInBackend.length === 0) {
            return {
              contractFulfilled: false,
              executionNotes: 'Pre-analise exige alteracao no backend, mas nenhuma foi detectada.',
              feedbackToAgent:
                `[VALIDACAO] A pre-analise desta tarefa exige alteracao REAL no backend. Voce ainda nao modificou arquivos em ${project?.backendPath || fullBackendPath}. Revise o backend, implemente a alteracao, atualize o relatorio e recrie o .done.`
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
        realWrittenFiles.length > 0 ||
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
