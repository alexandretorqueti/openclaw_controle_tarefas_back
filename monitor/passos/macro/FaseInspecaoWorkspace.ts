// monitor/passos/macro/FaseInspecaoWorkspace.ts
// ─────────────────────────────────────────────────────
// Macro Passo: FASE INSPEÇÃO DO WORKSPACE
// Responsabilidade: Inspecionar workspace após execução do programador,
// verificar alterações físicas e coletar evidências baseadas em modificações reais.
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';
import type { Snapshot, WorkspaceSnapshotService } from '../../services/WorkspaceSnapshotService';
import type { EvidenceService, Evidence } from '../../services/EvidenceService';

export interface InspecaoWorkspaceInput {
  tarefaAtual: TarefaCompleta;
  snapshotInicial: Snapshot;
  taskDir: string;
  rawOutput?: string;
  toolCall?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
}

export interface InspecaoWorkspaceOutput {
  sucesso: boolean;
  hasRealChanges: boolean;
  fileChanges: {
    modified: string[];
    created: string[];
    deleted: string[];
    total: number;
  };
  evidence: Evidence;
  errosCriticos?: string;
}

export interface DependenciasInspecaoWorkspace {
  logger: Logger;
  snapshotService: WorkspaceSnapshotService;
  evidenceService: EvidenceService;
}

export class MacroFaseInspecaoWorkspace extends PassoBase<InspecaoWorkspaceInput, InspecaoWorkspaceOutput> {
  readonly nome = 'Fase Inspeção do Workspace';
  private readonly snapshotService: WorkspaceSnapshotService;
  private readonly evidenceService: EvidenceService;

  constructor(deps: DependenciasInspecaoWorkspace) {
    super(deps);
    this.snapshotService = deps.snapshotService;
    this.evidenceService = deps.evidenceService;
  }

  public async execute(input: InspecaoWorkspaceInput): Promise<InspecaoWorkspaceOutput> {
    return await this.processar(input);
  }

  protected async processar(input: InspecaoWorkspaceInput): Promise<InspecaoWorkspaceOutput> {
    await this.logger.info(`🔍 Iniciando inspeção do workspace para tarefa [${input.tarefaAtual.id}].`);
    
    const { tarefaAtual, snapshotInicial, taskDir, rawOutput, toolCall, toolResult } = input;
    const projeto = tarefaAtual.project;
    
    try {
      // 1. COMPARAÇÃO DE SNAPSHOTS
      await this.logger.info(`📸 Comparando snapshots para detectar alterações...`);
      
      let hasRealChanges = false;
      let fileChanges = {
        modified: [] as string[],
        created: [] as string[],
        deleted: [] as string[],
        total: 0
      };
      
      try {
        // Diretório alvo para snapshot (pasta do projeto ou taskDir)
        const dirAlvo = projeto?.pastaBase || taskDir;
        
        // Captura snapshot atual
        const snapshotAtual = await this.snapshotService.takeSnapshot({
          dir: dirAlvo,
          ignoreList: ['node_modules', '.git', 'dist', 'build', '.next', '.db', '.log']
        });
        
        // Compara snapshots
        const comparacao = this.snapshotService.compareSnapshots({
          initialSnapshot: snapshotInicial,
          currentSnapshot: snapshotAtual
        });
        
        hasRealChanges = comparacao.hasChanges;
        fileChanges = {
          modified: comparacao.modified,
          created: comparacao.created,
          deleted: comparacao.deleted,
          total: comparacao.totalChanges
        };
        
        await this.logger.info(`📸 Alterações detectadas: ${hasRealChanges ? 'Sim' : 'Não'}`);
        if (hasRealChanges) {
          await this.logger.info(`   ├─ Modificados: ${comparacao.modified.length}`);
          await this.logger.info(`   ├─ Criados: ${comparacao.created.length}`);
          await this.logger.info(`   └─ Deletados: ${comparacao.deleted.length}`);
          
          // Log dos primeiros 3 arquivos modificados/criados para debug
          const allChanges = [...comparacao.modified, ...comparacao.created];
          const sampleChanges = allChanges.slice(0, 3);
          if (sampleChanges.length > 0) {
            await this.logger.debug(`   └─ Exemplos: ${sampleChanges.join(', ')}${allChanges.length > 3 ? '...' : ''}`);
          }
        }
      } catch (snapshotError: unknown) {
        const msg = snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
        await this.logger.erro(`⚠️ Erro ao comparar snapshots: ${msg}`);
        // Continua sem informações de snapshot, mas marca como sem alterações
        hasRealChanges = false;
      }
      
      // 2. COLETA DE EVIDÊNCIAS
      await this.logger.info(`📊 Coletando e estruturando evidências...`);
      
      // Cria evidência base
      let evidence = await this.evidenceService.createEmptyEvidence(tarefaAtual.id);
      
      // Aplica evidência de alterações de arquivos
      evidence = await this.evidenceService.applyFileChangesEvidence(evidence, fileChanges);
      
      // Aplica evidência de execução (tool calls/results)
      if (toolCall || toolResult) {
        evidence = await this.evidenceService.applyExecutionEvidence(
          evidence,
          toolCall || {},
          toolResult || {},
          {
            rawOutput,
            executionDirectory: projeto?.pastaBase || taskDir
          }
        );
      }
      
      // 3. VALIDAÇÃO DE CONSISTÊNCIA
      await this.logger.info(`✅ Validando consistência das evidências...`);
      
      const consistencia = this.evidenceService.validateEvidenceConsistency(evidence);
      if (!consistencia.valid) {
        await this.logger.info(`⚠️ Inconsistências nas evidências: ${consistencia.inconsistencies.join('; ')}`);
      }
      
      // 4. RESUMO FINAL
      await this.logger.info(`📈 Gerando resumo final...`);
      
      const sufficiency = this.evidenceService.hasSufficientEvidence(evidence);
      await this.logger.info(`📈 Suficiência de evidências: ${sufficiency.sufficient ? '✅ Suficiente' : '❌ Insuficiente'}`);
      if (sufficiency.reasons.length > 0) {
        await this.logger.info(`   └─ Razões: ${sufficiency.reasons.join(', ')}`);
      }
      
      // Log do resumo completo em debug
      const evidenceSummary = this.evidenceService.generateEvidenceSummary(evidence);
      await this.logger.debug(evidenceSummary);
      
      return {
        sucesso: true,
        hasRealChanges,
        fileChanges,
        evidence
      };
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.logger.erro(`💥 Erro crítico na inspeção do workspace: ${msg}`);
      
      // Retorna evidência mínima em caso de erro
      const evidence = await this.evidenceService.createEmptyEvidence(tarefaAtual.id);
      
      return {
        sucesso: false,
        hasRealChanges: false,
        fileChanges: {
          modified: [],
          created: [],
          deleted: [],
          total: 0
        },
        evidence,
        errosCriticos: `Erro na inspeção: ${msg}`
      };
    }
  }
}
