// monitor/passos/macro/FaseAnaliseArquiteto.ts
// ─────────────────────────────────────────────────────
// Macro Passo: FASE ANÁLISE DO ARQUITETO
// Responsabilidade: Analisar a resposta do arquiteto, verificar evidências,
// e decidir se a tarefa já foi executada ou precisa do programador.
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta, PlanoDeAnalise } from '../../interfaces';
import type { Project } from '@prisma/client';
import { Snapshot, SnapshotInput, WorkspaceSnapshotService } from '../../services/WorkspaceSnapshotService';

export interface AnaliseArquitetoInput {
  tarefaAtual: TarefaCompleta;
  planoAnalise: PlanoDeAnalise | null;
  respostaArquiteto: string;
  caminhoPlanoArquiteto: string;
  snapshotInicial: any;
  diretorioBase: string;
}

export interface AnaliseArquitetoOutput {
  sucesso: boolean;
  hasRealChanges?: boolean;
  existsDoneFile?: boolean;
  existsPlanoFile?: boolean;
}

export interface DependenciasAnaliseArquiteto {
  logger: Logger;
  
  snapshot: WorkspaceSnapshotService;
  fileSystem: any;
}

export class MacroFaseAnaliseArquiteto extends PassoBase<AnaliseArquitetoInput, AnaliseArquitetoOutput> {
  readonly nome = 'Fase Análise do Arquiteto';
  
  private readonly snapshot: WorkspaceSnapshotService;
  private readonly fileSystem: DependenciasAnaliseArquiteto['fileSystem'];

  constructor(deps: DependenciasAnaliseArquiteto) {
    super(deps);
    
    this.snapshot = deps.snapshot;
    this.fileSystem = deps.fileSystem;
  }

  public async execute(input: AnaliseArquitetoInput): Promise<AnaliseArquitetoOutput> {
    return await this.processar(input);
  }

  protected async processar(input: AnaliseArquitetoInput): Promise<AnaliseArquitetoOutput> {
    await this.logger.info(`🔍 Iniciando análise da resposta do arquiteto para tarefa [${input.tarefaAtual.id}].`);
    
    const { 
      tarefaAtual, 
      respostaArquiteto,
      caminhoPlanoArquiteto,
      snapshotInicial,
      diretorioBase 
    } = input;

    const projeto: Project = tarefaAtual.project;

    try {
      // 1. VERIFICAR EVIDÊNCIAS FÍSICAS
      await this.logger.info(`📊 Verificando evidências físicas de execução...`);
      
      // Função auxiliar para verificar se arquivo existe
      const arquivoExiste = async (caminho: string): Promise<boolean> => {
        try {
          await this.fileSystem.access(caminho);
          return true;
        } catch {
          return false;
        }
      };
      
      // 1.1. Verificar se arquivo .done existe
      const existeDoneFile = await arquivoExiste(caminhoPlanoArquiteto.replace('_architect_plan.json', '.done'));
      const snapshotInput : SnapshotInput = {
        dir: diretorioBase,
        ignoreList: ['node_modules', '.git', 'dist', 'build', '.next']
      };
      // 1.2. Comparar snapshots para detectar alterações
      const snapshotAtual: Snapshot = await this.snapshot.takeSnapshot(snapshotInput);
      const compareSnapshotsInput = {
        initialSnapshot: snapshotInicial,
        currentSnapshot: snapshotAtual
      }
      const mudancas = this.snapshot.compareSnapshots(compareSnapshotsInput);
      const temAlteracoesReais = mudancas.modified.length > 0 || mudancas.created.length > 0;
      
      await this.logger.info(`📈 Detecção: ${mudancas.modified.length} arquivos modificados, ${mudancas.created.length} criados, .done=${existeDoneFile}`);
      
      // Verificar se tem o arquivo do plano:
      const existsPlanoFile = await arquivoExiste(caminhoPlanoArquiteto);

      
      return {
        sucesso: true,
        hasRealChanges: temAlteracoesReais,
        existsDoneFile: existeDoneFile,
        existsPlanoFile: existsPlanoFile
      };
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.logger.erro(`💥 Erro na análise do arquiteto: ${msg}`);
      
      return {
        sucesso: false,
        hasRealChanges: false,
        existsDoneFile: false
      };
    }
  }
}