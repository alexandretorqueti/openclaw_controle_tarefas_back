// monitor/services/EvidenceService.ts
// ─────────────────────────────────────────────────────
// Serviço para coleta e estruturação de evidências de execução
// Baseado na implementação original do sistema legado
// ─────────────────────────────────────────────────────

import type { Logger } from '../interfaces/logger';

export interface Evidence {
  timestamp: string;
  taskId: string;
  hasRealChanges: boolean;
  fileChanges: {
    modified: string[];
    created: string[];
    deleted: string[];
    total: number;
  };
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  rawOutput?: string;
  analysis?: EvidenceAnalysis;
}

export interface ToolCall {
  type: string;
  name: string;
  args: Record<string, any>;
  timestamp: string;
}

export interface ToolResult {
  type: string;
  success: boolean;
  result: any;
  error?: string;
  timestamp: string;
}

export interface EvidenceAnalysis {
  isDeclaringDone: boolean;
  hasFulfilledContract: boolean;
  missingRequirements: string[];
  isTalkingWithoutAction: boolean;
  confidence: number;
}

export interface EvidenceServiceDeps {
  logger: Logger;
}

export class EvidenceService {
  readonly logger: Logger;

  constructor(deps: EvidenceServiceDeps) {
    this.logger = deps.logger;
  }

  /**
   * Cria evidência vazia
   */
  createEmptyEvidence(taskId: string): Evidence {
    return {
      timestamp: new Date().toISOString(),
      taskId,
      hasRealChanges: false,
      fileChanges: {
        modified: [],
        created: [],
        deleted: [],
        total: 0
      },
      toolCalls: [],
      toolResults: [],
      analysis: {
        isDeclaringDone: false,
        hasFulfilledContract: false,
        missingRequirements: [],
        isTalkingWithoutAction: false,
        confidence: 0
      }
    };
  }

  /**
   * Aplica evidências de execução (tool calls e results)
   */
  async applyExecutionEvidence(
    evidence: Evidence,
    toolCall: Record<string, any>,
    toolResult: Record<string, any>,
    context: {
      executionDirectory?: string;
      rawOutput?: string;
    } = {}
  ): Promise<Evidence> {
    const updatedEvidence = { ...evidence };
    
    // Adiciona tool call se existir
    if (toolCall && Object.keys(toolCall).length > 0) {
      updatedEvidence.toolCalls.push({
        type: toolCall.type || 'unknown',
        name: toolCall.name || 'unknown',
        args: toolCall.args || {},
        timestamp: new Date().toISOString()
      });
    }
    
    // Adiciona tool result se existir
    if (toolResult && Object.keys(toolResult).length > 0) {
      updatedEvidence.toolResults.push({
        type: toolResult.type || 'unknown',
        success: toolResult.success !== false,
        result: toolResult.result || toolResult,
        error: toolResult.error,
        timestamp: new Date().toISOString()
      });
    }
    
    // Adiciona raw output se fornecido
    if (context.rawOutput) {
      updatedEvidence.rawOutput = context.rawOutput;
    }
    
    await this.logger.debug(`📊 Evidência atualizada com ${updatedEvidence.toolCalls.length} tool calls`);
    
    return updatedEvidence;
  }

  /**
   * Aplica evidências de alterações de arquivos
   */
  async applyFileChangesEvidence(
    evidence: Evidence,
    fileChanges: {
      modified: string[];
      created: string[];
      deleted: string[];
    }
  ): Promise<Evidence> {
    const updatedEvidence = { ...evidence };
    
    updatedEvidence.fileChanges = {
      modified: [...evidence.fileChanges.modified, ...fileChanges.modified],
      created: [...evidence.fileChanges.created, ...fileChanges.created],
      deleted: [...evidence.fileChanges.deleted, ...fileChanges.deleted],
      total: evidence.fileChanges.total + fileChanges.modified.length + fileChanges.created.length + fileChanges.deleted.length
    };
    
    updatedEvidence.hasRealChanges = updatedEvidence.fileChanges.total > 0;
    
    await this.logger.debug(`📊 Evidência atualizada com ${fileChanges.modified.length} modificados, ${fileChanges.created.length} criados, ${fileChanges.deleted.length} deletados`);
    
    return updatedEvidence;
  }

  /**
   * Aplica análise às evidências
   */
  async applyAnalysisEvidence(
    evidence: Evidence,
    analysis: EvidenceAnalysis
  ): Promise<Evidence> {
    const updatedEvidence = { ...evidence };
    
    updatedEvidence.analysis = analysis;
    
    await this.logger.debug(`📊 Análise aplicada às evidências: ${analysis.hasFulfilledContract ? 'Contrato cumprido' : 'Contrato pendente'}`);
    
    return updatedEvidence;
  }

  /**
   * Verifica se há evidências suficientes para considerar execução concluída
   */
  hasSufficientEvidence(evidence: Evidence): {
    sufficient: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    
    // Critério 2: Alterações reais nos arquivos
    if (evidence.hasRealChanges) {
      reasons.push(`Alterações detectadas (${evidence.fileChanges.total} arquivos)`);
    }
    
    // Critério 3: Análise indica contrato cumprido
    if (evidence.analysis?.hasFulfilledContract) {
      reasons.push('Análise indica contrato cumprido');
    }
    
    // Critério 4: Tool calls executados
    if (evidence.toolCalls.length > 0) {
      reasons.push(`${evidence.toolCalls.length} ferramentas executadas`);
    }
    
    // Determina se é suficiente
    // Para tarefas de desenvolvimento: precisa de .done OU (alterações + análise positiva)
    // Para tarefas de análise: basta .done

    const hasPositiveAnalysis = evidence.analysis?.hasFulfilledContract;
    
    const sufficient = (evidence.hasRealChanges && hasPositiveAnalysis);
    
    return {
      sufficient,
      reasons
    };
  }

  /**
   * Gera resumo das evidências para logging
   */
  generateEvidenceSummary(evidence: Evidence): string {
    const lines: string[] = [];
    
    lines.push(`📊 RESUMO DE EVIDÊNCIAS - Tarefa ${evidence.taskId}`);
    lines.push(`📅 Timestamp: ${evidence.timestamp}`);
    lines.push(`🔄 Alterações: ${evidence.hasRealChanges ? `✅ ${evidence.fileChanges.total} arquivos` : '❌ Nenhuma'}`);
    
    if (evidence.fileChanges.total > 0) {
      lines.push(`   ├─ Modificados: ${evidence.fileChanges.modified.length}`);
      lines.push(`   ├─ Criados: ${evidence.fileChanges.created.length}`);
      lines.push(`   └─ Deletados: ${evidence.fileChanges.deleted.length}`);
    }
    
    lines.push(`🔧 Tool Calls: ${evidence.toolCalls.length}`);
    evidence.toolCalls.forEach((call, i) => {
      lines.push(`   ${i + 1}. ${call.name} (${call.type})`);
    });
    
    if (evidence.analysis) {
      lines.push(`🧠 Análise: ${evidence.analysis.hasFulfilledContract ? '✅ Contrato cumprido' : '⚠️ Contrato pendente'}`);
      lines.push(`   ├─ Declarou conclusão: ${evidence.analysis.isDeclaringDone ? 'Sim' : 'Não'}`);
      lines.push(`   ├─ Apenas falando: ${evidence.analysis.isTalkingWithoutAction ? 'Sim' : 'Não'}`);
      lines.push(`   └─ Confiança: ${evidence.analysis.confidence}%`);
      
      if (evidence.analysis.missingRequirements.length > 0) {
        lines.push(`   └─ Requisitos faltantes: ${evidence.analysis.missingRequirements.join(', ')}`);
      }
    }
    
    const sufficiency = this.hasSufficientEvidence(evidence);
    lines.push(`📈 Suficiência: ${sufficiency.sufficient ? '✅ Suficiente' : '❌ Insuficiente'}`);
    if (sufficiency.reasons.length > 0) {
      lines.push(`   └─ Razões: ${sufficiency.reasons.join(', ')}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Valida consistência das evidências
   */
  validateEvidenceConsistency(evidence: Evidence): {
    valid: boolean;
    inconsistencies: string[];
  } {
    const inconsistencies: string[] = [];
    
    // Inconsistência 2: Tem .done mas análise diz que contrato não foi cumprido
    if (evidence.analysis && !evidence.analysis.hasFulfilledContract) {
      inconsistencies.push('Arquivo .done existe mas análise indica contrato não cumprido');
    }
    
    // Inconsistência 3: Tem alterações mas nenhum tool call
    if (evidence.hasRealChanges && evidence.toolCalls.length === 0) {
      inconsistencies.push('Alterações detectadas mas nenhum tool call registrado');
    }
    
    // Inconsistência 4: Muitos tool calls mas nenhuma alteração
    if (evidence.toolCalls.length >= 3 && !evidence.hasRealChanges) {
      inconsistencies.push('Múltiplos tool calls executados mas nenhuma alteração detectada');
    }
    
    return {
      valid: inconsistencies.length === 0,
      inconsistencies
    };
  }
}