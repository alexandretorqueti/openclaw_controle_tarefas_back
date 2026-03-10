// src/services/evidenceService.js
// Servico para gerenciamento de evidencias de execucao

const path = require('path');
const { mergeUniquePaths, uniquePaths } = require('../utils/pathUtils');
const { inferReadOnlyEvidenceFromCommand } = require('../utils/commandUtils');

class EvidenceService {
  /**
   * Cria objeto de evidencia vazio
   * @returns {Object}
   */
  static createEmptyEvidence() {
    return {
      toolsUsed: [],
      filesRead: [],
      filesWritten: [],
      modifiedFiles: [],
      touchedFiles: [],
      commandsExecuted: [],
      noOpMutations: []
    };
  }

  /**
   * Aplica evidencias de uma execucao
   * @param {Object} executionEvidence - Evidencias atuais
   * @param {string} toolName - Nome da ferramenta
   * @param {Object} toolResult - Resultado da ferramenta
   * @param {Object} options - Opcoes
   * @returns {Object}
   */
  static applyExecutionEvidence(executionEvidence, toolName, toolResult = {}, options = {}) {
    const executionDirectory = options.executionDirectory || process.cwd();

    executionEvidence.toolsUsed = executionEvidence.toolsUsed || [];
    executionEvidence.filesRead = mergeUniquePaths(
      executionEvidence.filesRead || [],
      toolResult.filesRead || []
    );

    executionEvidence.filesWritten = mergeUniquePaths(
      executionEvidence.filesWritten || [],
      toolResult.filesWritten || []
    );

    executionEvidence.modifiedFiles = mergeUniquePaths(
      executionEvidence.modifiedFiles || [],
      toolResult.modifiedFiles || []
    );

    executionEvidence.touchedFiles = mergeUniquePaths(
      executionEvidence.touchedFiles || [],
      toolResult.touchedFiles || []
    );

    executionEvidence.commandsExecuted = Array.from(
      new Set([
        ...(executionEvidence.commandsExecuted || []),
        ...((toolResult.commandsExecuted || []).filter(Boolean)),
      ])
    );

    if (toolName && !executionEvidence.toolsUsed.includes(toolName)) {
      executionEvidence.toolsUsed.push(toolName);
    }

    // Para exec, infere evidencias adicionais
    if (toolName === 'exec') {
      for (const command of toolResult.commandsExecuted || []) {
        const inferred = inferReadOnlyEvidenceFromCommand(command, executionDirectory);

        executionEvidence.filesRead = mergeUniquePaths(
          executionEvidence.filesRead || [],
          inferred.filesRead || []
        );

        executionEvidence.touchedFiles = mergeUniquePaths(
          executionEvidence.touchedFiles || [],
          inferred.touchedFiles || []
        );
      }

      if (toolResult.executionDiagnostics?.noOpMutation) {
        executionEvidence.noOpMutations = [
          ...(executionEvidence.noOpMutations || []),
          {
            command: toolResult.commandsExecuted?.[0] || null,
            candidateFiles: uniquePaths(
              toolResult.executionDiagnostics.candidateFiles || []
            ),
          },
        ];
      }
    }

    return executionEvidence;
  }

  /**
   * Verifica se um arquivo e um artefato efemero (log, relatorio)
   * @param {string} filePath - Caminho do arquivo
   * @returns {boolean}
   */
  static isEphemeralArtifact(filePath = '') {
    const base = path.basename(filePath || '');

    return (
      /^terminal-\d+\.log$/i.test(base) ||
      /^relatorio-\d+\.txt$/i.test(base)
    );
  }

  /**
   * Calcula progresso do turno
   * @param {Object} toolResult - Resultado da ferramenta
   * @param {Object} contractResult - Resultado do contrato
   * @param {string} cwd - Diretorio de trabalho
   * @returns {Object}
   */
  static computeTurnProgress(toolResult = {}, contractResult = {}, cwd = process.cwd()) {
    const inferred =
      Array.isArray(toolResult.commandsExecuted) && toolResult.commandsExecuted.length > 0
        ? inferReadOnlyEvidenceFromCommand(toolResult.commandsExecuted[0], cwd)
        : { filesRead: [], modifiedFiles: [] };

    const meaningfulReads = mergeUniquePaths(
      toolResult.filesRead || [],
      inferred.filesRead || []
    ).filter((file) => !this.isEphemeralArtifact(file));

    const meaningfulMutations = uniquePaths(
      toolResult.modifiedFiles || []
    ).filter((file) => !this.isEphemeralArtifact(file));

    const noOpMutation = !!toolResult.executionDiagnostics?.noOpMutation;

    return {
      meaningfulReads,
      meaningfulMutations,
      noOpMutation,
      hasMeaningfulProgress:
        !!contractResult.contractFulfilled ||
        (
          !noOpMutation &&
          (
            meaningfulReads.length > 0 ||
            meaningfulMutations.length > 0
          )
        ),
    };
  }
}

module.exports = EvidenceService;
