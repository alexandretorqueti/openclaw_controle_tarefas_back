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
  arquitetoExecutou: boolean;
  precisaProgramador: boolean;
  confianca: number;
  detalhesExecucao?: string;
  planoDetalhado?: string;
  errosCriticos?: string;
}

export interface ServicoAnaliseTarefa {
  analisarRespostaArquiteto(
    respostaArquiteto: string,
    tarefa: TarefaCompleta,
    projeto: Project,
    evidencias: any
  ): Promise<{
    hasExecuted: boolean;
    hasPlan: boolean;
    confidence: number;
    executionDetails: string | null;
    planDetails: string | null;
    analysisFailed: boolean;
    hadExecuted?: boolean;
  }>;
}

export interface ServicoArquivos {
  existe(caminho: string): Promise<boolean>;
}

export interface DependenciasAnaliseArquiteto {
  logger: Logger;
  analiseTarefa: ServicoAnaliseTarefa;
  snapshot: WorkspaceSnapshotService;
  arquivos: ServicoArquivos;
}

export class MacroFaseAnaliseArquiteto extends PassoBase<AnaliseArquitetoInput, AnaliseArquitetoOutput> {
  readonly nome = 'Fase Análise do Arquiteto';
  private readonly analiseTarefa: ServicoAnaliseTarefa;
  private readonly snapshot: WorkspaceSnapshotService;
  private readonly arquivos: ServicoArquivos;

  constructor(deps: DependenciasAnaliseArquiteto) {
    super(deps);
    this.analiseTarefa = deps.analiseTarefa;
    this.snapshot = deps.snapshot;
    this.arquivos = deps.arquivos;
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
      
      // 1.1. Verificar se arquivo .done existe
      const existeDoneFile = await this.arquivos.existe(caminhoPlanoArquiteto.replace('.json', '.done'));
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
      
      // 2. ANALISAR RESPOSTA DO ARQUITETO COM IA
      await this.logger.info(`🧠 Analisando resposta do arquiteto com IA...`);
      
      const evidencias = {
        hasRealChanges: temAlteracoesReais,
        existsDoneFile: existeDoneFile,
        changes: mudancas
      };
      
      const analiseIA = await this.analiseTarefa.analisarRespostaArquiteto(
        respostaArquiteto,
        tarefaAtual,
        projeto,
        evidencias
      );
      
      await this.logger.info(`📊 Análise IA: executou=${analiseIA.hasExecuted}, plano=${analiseIA.hasPlan}, confiança=${analiseIA.confidence}%`);
      
      // 3. VALIDAÇÃO CRÍTICA: CONFRONTAR IA COM EVIDÊNCIAS FÍSICAS
      let analiseFinal = analiseIA;
      
      if ((analiseIA.hasExecuted && analiseIA.confidence > 70) || existeDoneFile) {
        await this.logger.info(`🔍 Validando evidências para execução alegada...`);
        
        // Para tarefas de análise, evidência pode ser apenas relatório/.done
        const tipoTarefa = input.planoAnalise?.taskType || 'development';
        const temEvidencias = existeDoneFile || 
                            (tipoTarefa === 'analysis' ? true : (temAlteracoesReais || analiseIA.hadExecuted));
        
        if (!temEvidencias) {
          await this.logger.info(`⚠️ Nenhuma evidência encontrada! Corrigindo análise...`);
          
          // Corrigir análise: não executou, apenas planejou
          analiseFinal = {
            hasExecuted: false,
            hasPlan: true,
            confidence: 80,
            executionDetails: null,
            planDetails: "Arquiteto gerou plano detalhado, mas não executou alterações (validação de evidências falhou)",
            analysisFailed: false,
            hadExecuted: false
          };
          
          await this.logger.info(`📊 Análise corrigida: executou=false, plano=true`);
        } else {
          await this.logger.info(`✅ Evidências confirmadas para execução`);
        }
      }
      
      // 4. DECISÃO DE FLUXO
      let arquitetoExecutou = false;
      let precisaProgramador = true;
      
      if (analiseFinal.hasExecuted && analiseFinal.confidence > 70) {
        // Arquiteto já executou a tarefa
        arquitetoExecutou = true;
        precisaProgramador = false;
        await this.logger.info(`✅ Decisão: Arquiteto já executou a tarefa. Finalizando ciclo.`);
      } else if (analiseFinal.hasPlan && !analiseFinal.analysisFailed) {
        // Arquiteto gerou plano, precisa do programador
        arquitetoExecutou = false;
        precisaProgramador = true;
        await this.logger.info(`📋 Decisão: Arquiteto gerou plano. Passando para programador.`);
      } else {
        // Análise falhou ou resposta inválida
        arquitetoExecutou = false;
        precisaProgramador = true;
        await this.logger.info(`⚠️ Decisão: Análise falhou. Passando para programador com descrição original.`);
      }
      
      return {
        sucesso: true,
        arquitetoExecutou,
        precisaProgramador,
        confianca: analiseFinal.confidence,
        detalhesExecucao: analiseFinal.executionDetails || undefined,
        planoDetalhado: analiseFinal.planDetails || undefined
      };
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.logger.erro(`💥 Erro na análise do arquiteto: ${msg}`);
      
      return {
        sucesso: false,
        arquitetoExecutou: false,
        precisaProgramador: true, // Fallback seguro: passa para programador
        confianca: 0,
        errosCriticos: `Erro na análise: ${msg}`
      };
    }
  }
}