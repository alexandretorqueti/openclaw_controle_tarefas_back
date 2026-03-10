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
    if (!filePath) return false;
    
    const base = path.basename(filePath || '');
    const fullPath = path.resolve(filePath);

    // Padrões de arquivos efêmeros que NÃO devem contar como progresso
    const ephemeralPatterns = [
      /^terminal-[^/]+\.log$/i,       // terminal-*.log (qualquer ID)
      /^relatorio-[^/]+\.txt$/i,      // relatorio-*.txt (qualquer ID)
      /^\.done$/i,                     // arquivos .done ocultos
      /\.lock$/i,                      // arquivos de lock
      /^monitor-state\.json$/i,        // estado do monitor
    ];
    
    // Verificar padrões no nome base
    for (const pattern of ephemeralPatterns) {
      if (pattern.test(base)) {
        return true;
      }
    }
    
    // Arquivos em diretórios de tarefas que são artefatos do sistema
    if (fullPath.includes('/tasks/') || fullPath.includes('/processed/')) {
      // Mas NÃO considerar .done como efêmero se estiver no diretório de tarefas
      // porque criar .done é parte do objetivo
      if (base.endsWith('.done') && !base.startsWith('.')) {
        return false;  // done-123.done NÃO é efêmero, é o objetivo!
      }
    }

    return false;
    
    // NOTA IMPORTANTE:
    // - done-*.done NÃO é efêmero porque criar .done é o objetivo final
    // - terminal-*.log É efêmero (apenas log)
    // - relatorio-*.txt É efêmero (relatório do sistema, não código)
  }

  /**
   * Calcula progresso do turno
   * BUG FIXES aplicados:
   * 1. Agora itera por TODOS os comandos executados, não apenas o primeiro
   * 2. Agora considera filesWritten além de modifiedFiles
   * 3. Agora considera touchedFiles para detectar atividade de análise
   * 
   * @param {Object} toolResult - Resultado da ferramenta
   * @param {Object} contractResult - Resultado do contrato
   * @param {string} cwd - Diretorio de trabalho
   * @returns {Object}
   */
  static computeTurnProgress(toolResult = {}, contractResult = {}, cwd = process.cwd()) {
    // BUG FIX: Iterar por TODOS os comandos, não apenas o primeiro
    let allInferredReads = [];
    const commandsExecuted = Array.isArray(toolResult.commandsExecuted) ? toolResult.commandsExecuted : [];
    
    for (const command of commandsExecuted) {
      const inferred = inferReadOnlyEvidenceFromCommand(command, cwd);
      allInferredReads = mergeUniquePaths(allInferredReads, inferred.filesRead || []);
    }

    // Merge de todas as leituras e filtrar efêmeros
    const meaningfulReads = mergeUniquePaths(
      toolResult.filesRead || [],
      allInferredReads
    ).filter((file) => !this.isEphemeralArtifact(file));

    // BUG FIX: Considerar TANTO modifiedFiles QUANTO filesWritten
    const allMutations = mergeUniquePaths(
      toolResult.modifiedFiles || [],
      toolResult.filesWritten || []
    );
    
    const meaningfulMutations = allMutations.filter((file) => !this.isEphemeralArtifact(file));

    // BUG FIX: Considerar touchedFiles para detectar atividade de análise
    const touchedFiles = (toolResult.touchedFiles || []).filter((file) => !this.isEphemeralArtifact(file));

    const noOpMutation = !!toolResult.executionDiagnostics?.noOpMutation;

    // BUG FIX: Progresso agora também considera touchedFiles
    const hasMeaningfulProgress = 
      !!contractResult.contractFulfilled ||
      (
        !noOpMutation &&
        (
          meaningfulReads.length > 0 ||
          meaningfulMutations.length > 0 ||
          touchedFiles.length > 0  // NOVO: arquivos tocados também contam
        )
      );

    return {
      meaningfulReads,
      meaningfulMutations,
      touchedFiles,
      noOpMutation,
      hasMeaningfulProgress,
    };
  }
}

module.exports = EvidenceService;
