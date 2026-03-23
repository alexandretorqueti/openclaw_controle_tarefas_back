// Migrado para TypeScript - Fase: Services
// Arquivo: evidenceService.js
// Serviço responsável por rastrear as ações da IA e gerar as evidências de execução

import * as path from 'path';
import { mergeUniquePaths, uniquePaths } from '../utils/pathUtils';
import { inferReadOnlyEvidenceFromCommand } from '../utils/commandUtils';
import { isEphemeralArtifact } from '../utils/fileUtils';

// Type definition for execution evidence
interface ToolResult {
  filesRead?: string[];
  filesWritten?: string[];
  modifiedFiles?: string[];
  touchedFiles?: string[];
  commandsExecuted?: string[];
  executionDiagnostics?: {
    noOpMutation?: boolean;
    candidateFiles?: string[];
  };
  contractFulfilled?: boolean;
}

interface ToolCall {
  name?: string;
  arguments?: {
    file_path?: string;
    path?: string;
    filePath?: string;
    command?: string;
  };
}

interface ExecutionEvidence {
  toolsUsed: string[];
  filesRead: string[];
  filesWritten: string[];
  modifiedFiles: string[];
  touchedFiles: string[];
  commandsExecuted: string[];
  noOpMutations: Array<{
    command: string | null;
    candidateFiles: string[];
  }>;
}

interface ApplyOptions {
  executionDirectory?: string;
}

// Validação de import em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  if (typeof inferReadOnlyEvidenceFromCommand !== 'function') {
    console.error('❌ evidenceService: inferReadOnlyEvidenceFromCommand não é uma função');
  }
}

class EvidenceService {
  /**
   * Cria um objeto de evidências vazio.
   */
  static createEmptyEvidence(): ExecutionEvidence {
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
   * Ignora arquivos de backup comuns criados por ferramentas como sed (-i.bak, etc)
   */
  static isBackupFile(filePath: string | undefined | null): boolean {
    if (!filePath) return false;
    const lowerPath = filePath.toLowerCase();
    return lowerPath.endsWith('.bak') || lowerPath.endsWith('~') || lowerPath.endsWith('.orig');
  }

  /**
   * Aplica o resultado de uma chamada de ferramenta ao objeto de evidências.
   * Modificado para inferir as intenções da IA diretamente do JSON, garantindo 
   * que arquivos editados sejam rastreados mesmo se o executor falhar em reportá-los.
   */
  static applyExecutionEvidence(
    executionEvidence: ExecutionEvidence,
    toolCall: ToolCall | string,
    toolResult: ToolResult = {},
    options: ApplyOptions = {}
  ): ExecutionEvidence {
    const executionDirectory = options.executionDirectory || process.cwd();
    
    // Suporte retroativo caso venha apenas a string do nome (para compatibilidade)
    const toolName = typeof toolCall === 'string' ? toolCall : toolCall?.name;

    executionEvidence.toolsUsed = executionEvidence.toolsUsed || [];
    executionEvidence.filesRead = mergeUniquePaths(executionEvidence.filesRead || [], toolResult.filesRead || []);
    executionEvidence.filesWritten = mergeUniquePaths(executionEvidence.filesWritten || [], toolResult.filesWritten || []);
    executionEvidence.modifiedFiles = mergeUniquePaths(executionEvidence.modifiedFiles || [], toolResult.modifiedFiles || []);
    executionEvidence.touchedFiles = mergeUniquePaths(executionEvidence.touchedFiles || [], toolResult.touchedFiles || []);
    
    const cmds = toolResult.commandsExecuted || [];
    executionEvidence.commandsExecuted = Array.from(new Set([...(executionEvidence.commandsExecuted || []), ...cmds.filter(Boolean)]));

    if (toolName && !executionEvidence.toolsUsed.includes(toolName)) {
      executionEvidence.toolsUsed.push(toolName);
    }

    // === O GRANDE FIX: Inferir arquivos alterados direto do JSON da IA ===
    if (toolCall && typeof toolCall === 'object' && toolCall.arguments) {
      const args = toolCall.arguments;
      const filePathArg = args.file_path || args.path || args.filePath;
      
      if (filePathArg && !this.isBackupFile(filePathArg)) {
        const absPath = path.resolve(executionDirectory, filePathArg);
        
        if (toolName === 'read') {
          executionEvidence.filesRead = mergeUniquePaths(executionEvidence.filesRead, [absPath]);
        }
        
        if (toolName === 'write' || toolName === 'edit') {
          // Garante que a alteração seja anotada como prova (evidence)
          executionEvidence.modifiedFiles = mergeUniquePaths(executionEvidence.modifiedFiles, [absPath]);
          executionEvidence.filesWritten = mergeUniquePaths(executionEvidence.filesWritten, [absPath]);
        }
      }

      // Se for exec, passa o comando pelo detetive independente do retorno do executor
      if (toolName === 'exec' && args.command) {
         if (!executionEvidence.commandsExecuted.includes(args.command)) {
           executionEvidence.commandsExecuted.push(args.command);
         }
         
         const inferred = inferReadOnlyEvidenceFromCommand(args.command, executionDirectory);
         // Filtra os backups nas leituras e escritas
         const filteredReads = (inferred.filesRead || []).filter(f => !this.isBackupFile(f));
         const filteredWrites = (inferred.modifiedFiles || []).filter(f => !this.isBackupFile(f));

         executionEvidence.filesRead = mergeUniquePaths(executionEvidence.filesRead, filteredReads);
         executionEvidence.modifiedFiles = mergeUniquePaths(executionEvidence.modifiedFiles, filteredWrites);
      }
    }

    // Mantém o processamento antigo via toolResult como fallback
    if (toolName === 'exec') {
      for (const command of toolResult.commandsExecuted || []) {
        const inferred = inferReadOnlyEvidenceFromCommand(command, executionDirectory);
        
        const filteredReads = (inferred.filesRead || []).filter(f => !this.isBackupFile(f));
        const filteredWrites = (inferred.modifiedFiles || []).filter(f => !this.isBackupFile(f));
        const filteredTouches = (inferred.touchedFiles || []).filter(f => !this.isBackupFile(f));

        executionEvidence.filesRead = mergeUniquePaths(executionEvidence.filesRead || [], filteredReads);
        executionEvidence.modifiedFiles = mergeUniquePaths(executionEvidence.modifiedFiles || [], filteredWrites);
        executionEvidence.touchedFiles = mergeUniquePaths(executionEvidence.touchedFiles || [], filteredTouches);
      }

      if (toolResult.executionDiagnostics?.noOpMutation) {
        executionEvidence.noOpMutations = [
          ...(executionEvidence.noOpMutations || []),
          {
            command: toolResult.commandsExecuted?.[0] || (toolCall && typeof toolCall === 'object' && toolCall.arguments ? toolCall.arguments.command : null),
            candidateFiles: uniquePaths(toolResult.executionDiagnostics.candidateFiles || []),
          },
        ];
      }
    }

    return executionEvidence;
  }

  /**
   * Calcula o progresso do turno atual, filtrando artefatos efêmeros.
   */
  static computeTurnProgress(
    toolResult: ToolResult = {},
    contractResult: { contractFulfilled?: boolean } = {},
    cwd: string = process.cwd()
  ): {
    meaningfulReads: string[];
    meaningfulMutations: string[];
    touchedFiles: string[];
    noOpMutation: boolean;
    hasMeaningfulProgress: boolean;
  } {
    let allInferredReads: string[] = [];
    let allInferredMutations: string[] = [];
    
    const commandsExecuted = Array.isArray(toolResult.commandsExecuted) ? toolResult.commandsExecuted : [];
    
    for (const command of commandsExecuted) {
      const inferred = inferReadOnlyEvidenceFromCommand(command, cwd);
      
      const filteredReads = (inferred.filesRead || []).filter(f => !this.isBackupFile(f));
      const filteredWrites = (inferred.modifiedFiles || []).filter(f => !this.isBackupFile(f));

      allInferredReads = mergeUniquePaths(allInferredReads, filteredReads);
      allInferredMutations = mergeUniquePaths(allInferredMutations, filteredWrites);
    }
    
    const directReads = (toolResult.filesRead || []).filter(f => !this.isBackupFile(f));
    const allReads = mergeUniquePaths(directReads, allInferredReads);
    const meaningfulReads = allReads.filter((file) => !isEphemeralArtifact(file));

    const modifiedFiles = (toolResult.modifiedFiles || []).filter(f => !this.isBackupFile(f));
    const filesWritten = (toolResult.filesWritten || []).filter(f => !this.isBackupFile(f));
    const allMutations = mergeUniquePaths(mergeUniquePaths(modifiedFiles, filesWritten), allInferredMutations);
    
    const meaningfulMutations = allMutations.filter((file) => !isEphemeralArtifact(file));

    const touchedFiles = (toolResult.touchedFiles || []).filter((file) => !isEphemeralArtifact(file) && !this.isBackupFile(file));
    const noOpMutation = !!toolResult.executionDiagnostics?.noOpMutation;
    
    const hasReads = meaningfulReads.length > 0;
    const hasMutations = meaningfulMutations.length > 0;
    const hasTouched = touchedFiles.length > 0;
    
    const contractFulfilled = !!contractResult.contractFulfilled;
    
    const hasMeaningfulProgress = 
      contractFulfilled || // Se cumpriu o contrato, é progresso AUTOMATICO!
      (
        !noOpMutation && 
        (hasReads || hasMutations || hasTouched)
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

export default EvidenceService;
