// monitor/passos/macro/FaseAnaliseProgramador.ts
// ─────────────────────────────────────────────────────
// Macro Passo: Análise do Programador (Inspeciona Workspace)
// Atualizado para usar o novo sistema completo de inspeção
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';
import type { Snapshot } from '../../services/WorkspaceSnapshotService';
import type { MacroFaseInspecaoWorkspace, InspecaoWorkspaceInput, InspecaoWorkspaceOutput } from './FaseInspecaoWorkspace';

export interface AnaliseProgramadorInput {
  tarefaAtual: TarefaCompleta;
  caminhoTaskDir: string;
  snapshotInicial?: Snapshot;
  diretorioBase?: string;
  rawOutput?: string;
  toolCall?: Record<string, any>;
  toolResult?: Record<string, any>;
}

export interface AnaliseProgramadorOutput {
  workspaceValidado: boolean;
  arquivosAlterados?: boolean;
  mensagem?: string;
  hasDoneFile?: boolean;
  hasRealChanges?: boolean;
  fileChanges?: {
    modified: string[];
    created: string[];
    deleted: string[];
    total: number;
  };
  evidence?: any;
  errosCriticos?: string;
}

export interface DependenciasAnaliseProgramador {
  logger: Logger;
  inspecaoWorkspace: MacroFaseInspecaoWorkspace;
}

export class MacroFaseAnaliseProgramador 
  extends PassoBase<AnaliseProgramadorInput, AnaliseProgramadorOutput> {
  readonly nome = 'Análise do Programador (Inspeção Completa)';
  private readonly inspecaoWorkspace: MacroFaseInspecaoWorkspace;

  constructor(deps: DependenciasAnaliseProgramador) {
    super(deps);
    this.inspecaoWorkspace = deps.inspecaoWorkspace;
  }

  public async execute(input: AnaliseProgramadorInput): Promise<AnaliseProgramadorOutput> {
    return await this.processar(input);
  }

  protected async processar(input: AnaliseProgramadorInput): Promise<AnaliseProgramadorOutput> {
    await this.logger.info(`🔎 Iniciando análise completa do workspace para tarefa [${input.tarefaAtual.id}]...`);
    
    // 1. Executar inspeção completa do workspace
    const inspecaoInput: InspecaoWorkspaceInput = {
      tarefaAtual: input.tarefaAtual,
      snapshotInicial: input.snapshotInicial || new Map(),
      taskDir: input.caminhoTaskDir,
      rawOutput: input.rawOutput,
      toolCall: input.toolCall,
      toolResult: input.toolResult
    };
    
    const inspecaoResult: InspecaoWorkspaceOutput = await this.inspecaoWorkspace.execute(inspecaoInput);
    
    if (!inspecaoResult.sucesso) {
      await this.logger.erro(`❌ Falha na inspeção do workspace: ${inspecaoResult.errosCriticos}`);
      return {
        workspaceValidado: false,
        mensagem: `Falha na inspeção: ${inspecaoResult.errosCriticos}`,
        errosCriticos: inspecaoResult.errosCriticos
      };
    }
    
    // 2. Avaliar resultados da inspeção
    const { hasDoneFile, hasRealChanges, fileChanges, evidence } = inspecaoResult;
    
    // 3. Tomar decisão baseada em evidências
    if (hasDoneFile) {
      // Tem arquivo .done - validação positiva
      await this.logger.info(`✅ Arquivo .done encontrado! Programador entregou artefato de conclusão.`);
      
      if (hasRealChanges) {
        await this.logger.info(`✅ Mudanças reais detectadas (${fileChanges.total} arquivos). Entrega validada.`);
      } else {
        await this.logger.info(`⚠️ Arquivo .done encontrado mas sem alterações detectadas. Pode ser tarefa de análise.`);
      }
      
      return {
        workspaceValidado: true,
        arquivosAlterados: hasRealChanges,
        hasDoneFile,
        hasRealChanges,
        fileChanges,
        evidence
      };
    } else if (hasRealChanges) {
      // Tem alterações mas não tem .done - precisa verificar se é suficiente
      await this.logger.info(`⚠️ Alterações detectadas (${fileChanges.total} arquivos) mas sem arquivo .done.`);
      
      // Verificar se há evidências suficientes mesmo sem .done
      const temEvidenciasSuficientes = fileChanges.total >= 1; // Pelo menos uma alteração
      
      if (temEvidenciasSuficientes) {
        await this.logger.info(`✅ Alterações suficientes detectadas. Workspace validado mesmo sem .done.`);
        return {
          workspaceValidado: true,
          arquivosAlterados: true,
          hasDoneFile: false,
          hasRealChanges: true,
          fileChanges,
          evidence
        };
      } else {
        await this.logger.erro(`❌ Alterações insuficientes e sem .done. Programador não entregou valor.`);
        return {
          workspaceValidado: false,
          mensagem: 'Programador não entregou artefato de conclusão (.done) e alterações insuficientes.',
          hasDoneFile: false,
          hasRealChanges: true,
          fileChanges,
          evidence
        };
      }
    } else {
      // Sem .done e sem alterações - falha
      await this.logger.erro(`❌ Nenhum artefato de entrega encontrado. Programador não executou a tarefa.`);
      return {
        workspaceValidado: false,
        mensagem: 'Nenhum arquivo .done encontrado e nenhuma alteração detectada no workspace.',
        hasDoneFile: false,
        hasRealChanges: false,
        fileChanges,
        evidence
      };
    }
  }
}
