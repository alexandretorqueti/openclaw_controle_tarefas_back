
// monitor/Orquestrador.ts
// ─────────────────────────────────────────────────────
// ORQUESTRADOR IMPERATIVO (Imperative Orchestration)
//
// O coração do sistema. Abandonamos a Máquina de Estados
// (mapas de transição cegos) em favor de código puro.
// O fluxo (if, while, loops) é ditado por esta classe.
// ─────────────────────────────────────────────────────

import type { Logger } from './interfaces/logger';

import type { TarefaCompleta, ConfiguracaoMonitor, ContextoExecucao, ProcessoFantasma } from './interfaces';
import type { Project } from '@prisma/client';

// Importando a Lógica Pura (Passos Atômicos)
import { 
  DependenciasVerificaLock, 
  PassoVerificaLock, 
  VerificaLockInput, 
  VerificaLockOutput 
} from './passos/atomicos/PassoVerificaLock';
import { DependenciasInicializaTarefa, InicializaTarefaInput } from './passos/atomicos/PassoInicializaTarefa';
import { ConfiguraUsuarioInput } from './passos/atomicos/PassoConfiguraUsuario';
import { PassoVerificaTimeout, VerificaTimeoutInput } from './passos/atomicos/PassoVerificaTimeout';
import { DependenciasVerificaAtomicidade, VerificaAtomicidadeInput} from './passos/atomicos/PassoVerificaAtomicidade';
import { VerificaDominioInput, VerificaDominioOutput, DependenciasVerificaDominio } from './passos/atomicos/PassoVerificaDominio';
import { WorkspaceSnapshotServiceDeps, SnapshotInput, Snapshot, WorkspaceSnapshotService } from './services/WorkspaceSnapshotService';
import { ConfiguraUsuarioOutput, DependenciasConfiguraUsuario, PassoConfiguraUsuario } from './passos/atomicos/PassoConfiguraUsuario';
import { BuscaTarefaInput, BuscaTarefaOutput, DependenciasBuscaTarefa, PassoBuscaTarefa } from './passos/atomicos/PassoBuscaTarefa';
import { InicializaTarefaOutput, PassoInicializaTarefa } from './passos/atomicos/PassoInicializaTarefa';
import { DependenciasSuperValidacao, PassoSuperValidacao, SuperValidacaoInput, SuperValidacaoOutput } from './passos/atomicos/PassoSuperValidacao';
import { DependenciasDecompoeTarefa, PassoDecompoeTarefa, DecomposicaoOutput, DecomposicaoInput } from './passos/atomicos/PassoDecompoeTarefa';
import { PassoVerificaDominio } from './passos/atomicos/PassoVerificaDominio';
import { PassoVerificaAtomicidade, VerificaAtomicidadeOutput } from './passos/atomicos/PassoVerificaAtomicidade';
import { DependenciasFaseArquiteto, FaseArquitetoInput, FaseArquitetoOutput, MacroFaseArquiteto } from './passos/macro/FaseArquiteto';
import { DependenciasAnaliseArquiteto, AnaliseArquitetoInput, AnaliseArquitetoOutput, MacroFaseAnaliseArquiteto } from './passos/macro/FaseAnaliseArquiteto';
import { DependenciasFaseProgramador, FaseProgramadorInput, FaseProgramadorOutput, MacroFaseProgramador } from './passos/macro/FaseProgramador';
import { DependenciasAnaliseProgramador, AnaliseProgramadorInput, AnaliseProgramadorOutput, MacroFaseAnaliseProgramador } from './passos/macro/FaseAnaliseProgramador';
import { FinalizacaoInput, FinalizacaoOutput, MacroFaseFinalizacao } from './passos/macro/FaseFinaliza';
import { DependenciasExecutarComando, ExecutarComandoInput, ExecutarComandoOutput, PassoExecutarComando } from './passos/atomicos/PassoExecutarComando';
import { FabricaPromptsIA } from './utils/fabricaPrompts';
import { DependenciasBase } from './passos';
import { DependenciasFinalizacao } from './passos/macro/FaseFinaliza';
import { DoneFileServiceDeps } from './services/DoneFileService';
import { EvidenceServiceDeps } from './services/EvidenceService';
import { DependenciasInspecaoWorkspace, MacroFaseInspecaoWorkspace } from './passos/macro/FaseInspecaoWorkspace';
import { ConfiguracaoFalha } from './passos/atomicos/PassoVerificaDominio';
// Novos serviços para gestão de feedback e sessões
import type { SessionManager, SessionInfo } from './services/SessionManagerService';
import type { FeedbackService } from './services/FeedbackService';
import { AnaliseArquitetoEAnaliseArquitetoInput, AnaliseArquitetoEAnaliseArquitetoOutput, DependenciasArquitetoEAnaliseArquiteto, FaseLoopAnalistaEAnalise } from './passos/macro/FaseLoopAnalistaEAnalise';
import passoPreAnaliseEscopoTarerefa, { DependenciasPreAnaliseEscopoTarerefa, preAnaliseEscopoTarefaIn } from './passos/atomicos/PreAnaliseEscopoTarefaStep';
import PromptFactory from '../src/utils/promptFactory';
import { UniversalAgentEngine } from './services/universalEngine/universalAgentEngine';
import { retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType } from './interfaces/retornosIA';

export interface DependenciasGlobais {
  logger: Logger;
  config: ConfiguracaoMonitor;
  // Serviços de infra
  servicoLock: any;
  servicoEstado: any;
  servicoArquivos: any;
  servicoUsuario: any;
  clienteApi: any;
  fileSystem: any;
  pathUtil: any;
  // Serviços de domínio/IA
  servicoBusca: any;
  servicoAnaliseTarefa: any;
  servicoAnalista: any;
  servicoOpenClaw: any;
  servicoDisco: any;
  servicoSnapshot: WorkspaceSnapshotService;
  servicoLlmAuxiliar?: any; // Para determinar domínio
  servicoLlmAtomicidade?: any; // Para determinar atomicidade
  jsonValidator: any;
  gerenciadorFalha: any;
  fabricaPrompts?: any; // Para gerar prompts
  // Novos serviços para feedback iterativo (TODOs 4 e 6)
  sessionManager?: SessionManager;
  feedbackService?: FeedbackService;
  motorUniversal?: UniversalAgentEngine;
  // utils
  criarContexto: () => ContextoExecucao;
}

export class OrquestradorTarefas {
  constructor(private readonly deps: DependenciasGlobais) {}

  /**
   * Avalia a necessidade de correção baseada na análise do programador
   * (TODO 4: Centralizar lógica de decisão de feedback)
   */
  private async avaliarNecessidadeCorrecao(
    ctx: ContextoExecucao,
    analise: AnaliseProgramadorOutput,
    logger: Logger
  ): Promise<{
    precisaCorrecao: boolean;
    manterSessao: boolean;
    feedbackParaProgramador: string;
    sessionId?: string; // ID da sessão para continuar conversação
    novoTipoFalha?: string;
  }> {
    const resultadoPadrao = {
      precisaCorrecao: false,
      manterSessao: false,
      feedbackParaProgramador: '',
      sessionId: undefined,
      novoTipoFalha: undefined
    };

    // Se workspace foi validado, não precisa correção
    if (analise.workspaceValidado) {
      await logger.info('✅ Workspace validado - sem necessidade de correção');
      return resultadoPadrao;
    }

    // Verificar se temos serviços de feedback disponíveis
    const temServicosFeedback = this.deps.feedbackService && this.deps.sessionManager;
    
    // Inicializar controle de sessão se necessário
    if (!ctx.controle.tentativasCorrecao) {
      ctx.controle.tentativasCorrecao = 0;
      ctx.controle.maxTentativasCorrecao = 3; // Máximo de 3 tentativas de correção
    }

    // Verificar se ainda temos tentativas disponíveis
    if (ctx.controle.tentativasCorrecao >= ctx.controle.maxTentativasCorrecao!) {
      await logger.info(`❌ Esgotadas ${ctx.controle.maxTentativasCorrecao} tentativas de correção`);
      return {
        precisaCorrecao: false, // Não tenta mais, vai falhar
        manterSessao: false,
        feedbackParaProgramador: '',
        sessionId: ctx.controle.sessaoId || undefined,
        novoTipoFalha: analise.tipoFalha
      };
    }

    // Determinar se precisa de correção baseado no tipo de falha
    const precisaCorrecao = analise.precisaCorrecao || 
                           analise.tipoFalha === 'SEM_DONE' ||
                           analise.tipoFalha === 'SEM_ALTERACOES' ||
                           analise.tipoFalha === 'ALTERACOES_INSUFICIENTES' ||
                           analise.tipoFalha === 'NADA_FEITO' ||
                           analise.tipoFalha === 'BUILD_FALHOU' ||
                           analise.tipoFalha === 'TESTES_FALHARAM';

    if (!precisaCorrecao) {
      await logger.info('⚠️ Análise indica problema, mas não requer correção iterativa');
      return resultadoPadrao;
    }

    // Incrementar contador de tentativas
    ctx.controle.tentativasCorrecao += 1;
    
    // Preparar feedback
    let feedbackParaProgramador = '';
    let sessionId: string | undefined = undefined;
    
    if (temServicosFeedback) {
      // Usar serviço de feedback para formatar mensagem
      sessionId = ctx.controle.sessaoId 
        ? await this.deps.sessionManager!.getOrCreateSession(
            ctx.tarefaAtual!.id.toString(), 
            'senior-developer'
          )
        : await this.deps.sessionManager!.getOrCreateSession(
            ctx.tarefaAtual!.id.toString(),
            'senior-developer'
          );
      
      const sessionInfo = await this.deps.sessionManager!.getSessionInfo(sessionId);
      
      feedbackParaProgramador = await this.deps.feedbackService!.formatFeedback(analise, ctx.tarefaAtual!.id.toString(), sessionInfo);
      
      // Enviar feedback para a sessão
      await this.deps.sessionManager!.sendFeedback(sessionId, feedbackParaProgramador);
      ctx.controle.sessaoId = sessionId;
      
    } else {
      // Fallback: usar mensagem da análise
      feedbackParaProgramador = analise.mensagemCorrecao || 
                               'O trabalho precisa de ajustes. Por favor, revise a implementação.';
    }

    await logger.info(`🔄 Correção solicitada (tentativa ${ctx.controle.tentativasCorrecao}/${ctx.controle.maxTentativasCorrecao}): ${analise.tipoFalha}`);
    
    return {
      precisaCorrecao: true,
      manterSessao: true, // Mantém sessão para correção
      feedbackParaProgramador,
      sessionId,
      novoTipoFalha: analise.tipoFalha
    };
  }



/**
   * O fluxo mestre do Jarbas.
   * Lemos este método de cima para baixo. Dividido em 3 grandes blocos:
   * 1. Setup Linear (Lock, Buscas, IA Arquiteto)
   * 2. Loop de Correção (Programador <-> Análise)
   * 3. Fechamento (Testes Locais e Finalização)
   */
  public async executarCicloDaTarefa(): Promise<void> {
    const logger = this.deps.logger;
    const ctx = this.deps.criarContexto();
    
    // Variáveis de controle do estado final da tarefa
    let mensagemFinal = '';
    let novoStatus = ctx.config.STATUS.IN_PROGRESS;
    let fluxoEncerradoPrematuramente = false;

    try {
      // ────────────────────────────────────────────────────────
      // BLOCO 1: SETUP LINEAR (Executa estritamente 1 vez)
      // ────────────────────────────────────────────────────────
      await logger.debug('🔄 Iniciando ciclo de tarefa...');

      // PASSO 1: PREPARAÇÃO DO AMBIENTE (Lock)
      {
        const lockStatus = await new PassoVerificaLock({
          logger,
          lockService: this.deps.servicoLock,
          stateService: this.deps.servicoEstado,
        } as DependenciasVerificaLock).execute({ timeoutMs: ctx.config.TASK_TIMEOUT_MS } as VerificaLockInput);

        ctx.lockAtivo = lockStatus.lockAtivo;

        if (ctx.lockAtivo) return; // Lock ativo: encerra silenciosamente

        if (lockStatus.processoFantasmaPid) {
          ctx.controle.processoFantasma = { pid: lockStatus.processoFantasmaPid } as ProcessoFantasma;
          await new PassoVerificaTimeout({ logger } as DependenciasBase)
            .execute({ processoFantasmaPid: lockStatus.processoFantasmaPid } as VerificaTimeoutInput);
          return; // Eject: Intervenção manual.
        }
      }

      // PASSO 2: CONFIGURAÇÃO DO USUÁRIO
      {
        const configUsuario = await new PassoConfiguraUsuario({
          logger,
          userService: this.deps.servicoUsuario,
        } as DependenciasConfiguraUsuario).execute({ nickname: ctx.config.MY_USER_NICKNAME } as ConfiguraUsuarioInput);

        ctx.UserId = configUsuario.userId;
      }

      // PASSO 3: BUSCA DE TAREFA
      {
        const busca = await new PassoBuscaTarefa({
          logger,
          buscadorTarefa: this.deps.servicoBusca,
        } as DependenciasBuscaTarefa).execute({ nickname: ctx.config.MY_USER_NICKNAME } as BuscaTarefaInput);

        if (!busca.tarefa) {
          return; // Eject silencioso: Fila vazia
        }

        ctx.tarefaAtual = busca.tarefa;
        await logger.info(`🎯 Tarefa selecionada: ${ctx.tarefaAtual.title} [${ctx.tarefaAtual.id}]`);
      }

      // PASSO 4: INICIALIZAÇÃO DA TAREFA
      {
        const inicializacao = await new PassoInicializaTarefa({
          logger,
          stateService: this.deps.servicoEstado,
          lockService: this.deps.servicoLock,
          clienteApi: this.deps.clienteApi,
          fileSystem: this.deps.fileSystem,
          config: ctx.config,
          path: this.deps.pathUtil,
        } as DependenciasInicializaTarefa).execute({
          tarefa: ctx.tarefaAtual,
          tasksDir: ctx.config.TASKS_DIR,
          apiUrl: ctx.config.API_URL,
          statusInProgress: ctx.config.STATUS.IN_PROGRESS
        } as InicializaTarefaInput);

        if (!inicializacao.sucesso) {
          ctx.erros.inicializacao = true;
          return; // Falha grave de FileSystem
        }
        ctx.controle.taskDir = inicializacao.taskDir;
      }


      // PASSO 5: PREANALISE ESCOPO TAREFA COM IA
      {
        const preanalise: retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType = await new passoPreAnaliseEscopoTarerefa({
          logger,
          FabricaPromptsIA: FabricaPromptsIA,
          motorUniversal: this.deps.motorUniversal
        } as DependenciasPreAnaliseEscopoTarerefa)
        .execute
        (
          { 
            tarefa: ctx.tarefaAtual,
            project: ctx.project,
            files: ctx.files,
            
          } as preAnaliseEscopoTarefaIn);
      }
      // PASSO 5: SUPER VALIDAÇÃO
      {
        const superValidacao = await new PassoSuperValidacao({
          logger,
          taskAnalysisService: this.deps.servicoAnaliseTarefa
        } as DependenciasSuperValidacao).execute({ tarefa: ctx.tarefaAtual } as SuperValidacaoInput);

        if (!superValidacao.valido) {
          ctx.erros.fatalIA = true;
          return; // Tarefa malformada
        }
        ctx.analysisPlan = superValidacao.planoDeAnalise || null;
      }

      // PASSO 6: DETERMINAÇÃO DE ATOMICIDADE
      {
        if (ctx.tarefaAtual.isAtomic === undefined || ctx.tarefaAtual.isAtomic === null) {
          const resultadoAtomicidade = await new PassoVerificaAtomicidade({
            logger,
            servicoLlmAtomicidade: this.deps.servicoLlmAtomicidade,
            fabricaPrompts: FabricaPromptsIA,
          } as DependenciasVerificaAtomicidade).execute({ tarefa: ctx.tarefaAtual } as VerificaAtomicidadeInput);
          
          ctx.tarefaAtual.isAtomic = resultadoAtomicidade.isAtomic;
          await logger.info(`🔍 Atomicidade: ${ctx.tarefaAtual.isAtomic ? 'ATÔMICA' : 'NÃO ATÔMICA'}`);
        }
      }

      // PASSO 7: DECOMPOSIÇÃO
      if (ctx.tarefaAtual.isAtomic === false) {
        const decomposicao: DecomposicaoOutput = await new PassoDecompoeTarefa({
          logger,
          analista: this.deps.servicoAnalista,
        } as DependenciasDecompoeTarefa).execute({
          tarefaAtual: ctx.tarefaAtual,
          userId: ctx.UserId,
          prompt: FabricaPromptsIA.gerarPromptDecomposicao(ctx.tarefaAtual),
        } as DecomposicaoInput);

        if (!decomposicao.sucesso) {
          await logger.erro('IA falhou ao decompor tarefa.');
          return;
        }

        if (decomposicao.subtasksCreated > 0) {
          return; // Tarefa mãe virou épico, encerra por aqui pois as filhas entrarão na fila
        }
        ctx.tarefaAtual.isAtomic = true; // Fallback: IA decidiu não decompor
      }

      // PASSO 8: DETERMINAÇÃO DE DOMÍNIO
      {
        const dominio = await new PassoVerificaDominio({
          logger,
          gerenciadorFalha: this.deps.gerenciadorFalha,
          servicoLlmAuxiliar: this.deps.servicoLlmAuxiliar,
          fabricaPrompts: FabricaPromptsIA,
        } as DependenciasVerificaDominio).execute({
          tarefa: ctx.tarefaAtual,
          userId: ctx.UserId,
          configFalha: { apiUrl: ctx.config.API_URL, tasksDir: ctx.config.TASKS_DIR, errorDir: ctx.config.ERROR_DIR }
        } as VerificaDominioInput);

        if (!dominio.dominioValido) return;
        if (dominio.dominio) ctx.tarefaAtual.domain = dominio.dominio;
      }

      // CAPTURA DO SNAPSHOT INICIAL (Pré-Arquiteto)
      {
        const snapshotService = new WorkspaceSnapshotService({ logger, fileSystem: this.deps.fileSystem } as WorkspaceSnapshotServiceDeps);
        ctx.initialSnapshot = await snapshotService.takeSnapshot({ dir: this.deps.config.BASE_DIR } as SnapshotInput);
      }

      // PASSO 9: FASE DO ARQUITETO
     
      {
        
        const faseLoopAnalistaEAnalise = new FaseLoopAnalistaEAnalise({
          clienteApi: this.deps.clienteApi,
          config: this.deps.config,
          disco: this.deps.servicoDisco,
          fabricaPrompts: FabricaPromptsIA,
          fileSystem: this.deps.fileSystem,
          jsonValidator: this.deps.jsonValidator,
          openClaw: this.deps.servicoOpenClaw,
          snapshot: this.deps.servicoSnapshot,
          logger,
          pathUtil: this.deps.pathUtil,
          servicoDisco: this.deps.servicoDisco,
          servicoSnapshot: this.deps.servicoSnapshot,
          servicoOpenClaw: this.deps.servicoOpenClaw
        } as DependenciasArquitetoEAnaliseArquiteto)
        

        // TODO TERMINAR AQUI
        const resultadoLoopAnalistaEAnalise: AnaliseArquitetoEAnaliseArquitetoOutput = await faseLoopAnalistaEAnalise.execute({
          analysisPlan: ctx.analysisPlan,
          resultados: ctx.resultados,
          tarefaAtual: ctx.tarefaAtual,
          userId: ctx.UserId,
          controle: ctx.controle
        } as AnaliseArquitetoEAnaliseArquitetoInput);


      }


      // ────────────────────────────────────────────────────────
      // BLOCO 2: LOOP DE CORREÇÃO (Programador <-> Análise)
      // ────────────────────────────────────────────────────────
      
      let precisaCorrecao = true;
      let falhaIrreversivelNoProgramador = false;
      ctx.controle.tentativasCorrecao = 0;
      ctx.controle.maxTentativasCorrecao = 3;

      // Só entra no loop se o arquiteto não encerrou a tarefa sozinho
      while (!fluxoEncerradoPrematuramente && precisaCorrecao && ctx.controle.tentativasCorrecao < ctx.controle.maxTentativasCorrecao!) {
        ctx.controle.tentativasCorrecao++;
        await logger.info(`🔄 Iniciando iteração do Programador: ${ctx.controle.tentativasCorrecao}/${ctx.controle.maxTentativasCorrecao}`);

        // PASSO 11: FASE DO PROGRAMADOR
        const planoParaProgramador = ctx.resultados.arquiteto.planoArquiteto || ctx.tarefaAtual.description;
        const resultProgramador = await new MacroFaseProgramador({
          logger, openClaw: this.deps.servicoOpenClaw, jsonValidator: this.deps.jsonValidator, config: this.deps.config
        } as DependenciasFaseProgramador).execute({
          tarefaAtual: ctx.tarefaAtual,
          planoArquiteto: FabricaPromptsIA.gerarPromptProgramador(ctx.tarefaAtual, planoParaProgramador, ctx.controle.taskDir || ''),
          sessionId: ctx.controle.sessaoId,
          feedbackPendente: ctx.controle.feedbackPendente
        } as FaseProgramadorInput);

        if (!resultProgramador.sucesso) {
          falhaIrreversivelNoProgramador = true;
          mensagemFinal = '❌ Programador falhou ou estourou limites de turnos na execução.';
          novoStatus = ctx.config.STATUS.FAILED;
          break; // Quebra o loop, vai direto para finalização
        }

        ctx.resultados.programador = resultProgramador;

        // PASSO 12: ANÁLISE DO TRABALHO (Inspeção)
        const faseInspecaoWorkspace = new (await import('./passos/macro/FaseInspecaoWorkspace')).MacroFaseInspecaoWorkspace({
          logger, snapshotService: this.deps.servicoSnapshot, 
          doneFileService: new (await import('./services/DoneFileService')).DoneFileService({ logger, fileSystem: this.deps.fileSystem, path: this.deps.pathUtil }),
          evidenceService: new (await import('./services/EvidenceService')).EvidenceService({ logger })
        } as DependenciasInspecaoWorkspace);

        const analise = await new MacroFaseAnaliseProgramador({
          logger, inspecaoWorkspace: faseInspecaoWorkspace
        } as DependenciasAnaliseProgramador).execute({
          tarefaAtual: ctx.tarefaAtual,
          caminhoTaskDir: ctx.controle.taskDir || '',
          snapshotInicial: ctx.initialSnapshot,
          diretorioBase: this.deps.config.BASE_DIR,
          rawOutput: ctx.resultados.programador.rawOutput,
          toolCall: ctx.resultados.programador.toolCall,
          toolResult: ctx.resultados.programador.toolResult
        } as AnaliseProgramadorInput);

        ctx.resultados.resultAnaliseProgramador = analise;

        // MOTOR DE DECISÃO: Continua o loop ou encerra?
        const avaliacao = await this.avaliarNecessidadeCorrecao(ctx, analise, logger);

        if (avaliacao.precisaCorrecao) {
          // Prepara contexto para a PRÓXIMA volta do loop
          ctx.controle.feedbackPendente = avaliacao.feedbackParaProgramador;
          if (avaliacao.sessionId) {
            ctx.controle.sessaoId = avaliacao.sessionId;
            ctx.controle.sessaoAtiva = true;
          }
          await logger.info(`🔄 Correção solicitada. Motivo: ${avaliacao.novoTipoFalha}.`);
          // O loop while vai girar de novo pois precisaCorrecao continua true
        } else {
          // Sai do loop. Ou deu sucesso (validado) ou falhou por limite de tentativas
          precisaCorrecao = false; 
          
          if (analise.workspaceValidado) {
            mensagemFinal = '✅ Trabalho validado. Prosseguindo para testes locais.';
            novoStatus = ctx.config.STATUS.IN_PROGRESS; // Continua em progresso para a Fase 3
          } else {
            falhaIrreversivelNoProgramador = true;
            mensagemFinal = `❌ Tarefa rejeitada. Último erro: ${analise.mensagemCorrecao}`;
            novoStatus = ctx.config.STATUS.FAILED;
          }
        }
      }

      // Verificação pós-loop de tentativas
      if (precisaCorrecao && ctx.controle.tentativasCorrecao >= ctx.controle.maxTentativasCorrecao!) {
         falhaIrreversivelNoProgramador = true;
         mensagemFinal = `❌ Tarefa abortada: Limite de ${ctx.controle.maxTentativasCorrecao} correções atingido.`;
         novoStatus = ctx.config.STATUS.FAILED;
      }


      // ────────────────────────────────────────────────────────
      // BLOCO 3: FECHAMENTO (Testes Locais e Finalização da Fila)
      // ────────────────────────────────────────────────────────

      // PASSO 13: TESTES (Só roda se não houve falha irreversível antes e se não encerrou no arquiteto)
      if (!fluxoEncerradoPrematuramente && !falhaIrreversivelNoProgramador) {
        const executor = new PassoExecutarComando({ 
          logger, 
          terminal: {
            executar: async (comando, opcoes) => {
              const { exec } = require('child_process');
              const { promisify } = require('util');
              return promisify(exec)(comando, opcoes);
            }
          }
        } as DependenciasExecutarComando);

        let buildSucesso = true;
        let testesSucesso = true;
        let logsErro = '';

        // Executa Build
        if ((ctx.tarefaAtual.domain === 'BACKEND' && ctx.project?.backendBuildCmd) || (ctx.tarefaAtual.domain === 'FRONTEND' && ctx.project?.frontendBuildCmd)) {
          await logger.info('🔨 Executando Build/Lint...');
          const build = await executor.execute({ comando: ctx.tarefaAtual.domain === 'BACKEND' ? ctx.project.backendBuildCmd : ctx.project.frontendBuildCmd, diretorioDeTrabalho: this.deps.config.BASE_DIR } as ExecutarComandoInput);
          buildSucesso = build.sucesso;
          if (!buildSucesso) logsErro += `Erro de Build:\n${build.stderr}\n`;
        }

        // Executa Testes
        if ((ctx.tarefaAtual.domain === 'BACKEND' && ctx.project?.backendTestCommand) || (ctx.tarefaAtual.domain === 'FRONTEND' && ctx.project?.frontendTestCommand)) {
          await logger.info('🧪 Executando Testes...');
          const testes = await executor.execute({ comando: ctx.tarefaAtual.domain === 'BACKEND' ? ctx.project.backendTestCommand : ctx.project.frontendTestCommand, diretorioDeTrabalho: this.deps.config.BASE_DIR } as ExecutarComandoInput);
          testesSucesso = testes.sucesso;
          if (!testesSucesso) logsErro += `Erro de Testes:\n${testes.stderr}\n`;
        }

        if (buildSucesso && testesSucesso) {
          mensagemFinal = `✅ Tudo verde! Código passou nos testes e builds.`;
          novoStatus = ctx.config.STATUS.COMPLETED;
        } else {
          // Falha nos testes causa falha na tarefa (não volta para o loop de IA local)
          mensagemFinal = `❌ Pipeline Local Falhou!\n${logsErro.substring(0, 500)}`;
          novoStatus = ctx.config.STATUS.FAILED;
        }
      }

      // PASSO 14: FINALIZAÇÃO
      if (!fluxoEncerradoPrematuramente) {
        await logger.debug('🔄 Encerrando a tarefa e limpando sessões...');

        // Fecha a sessão no OpenClaw, se existir
        if (ctx.controle.sessaoId && this.deps.sessionManager) {
          try {
            await this.deps.sessionManager.closeSession(ctx.controle.sessaoId);
            ctx.controle.sessaoId = null;
            ctx.controle.sessaoAtiva = false;
          } catch (error) {
            await logger.erro(`Erro ao fechar sessão no OpenClaw: ${error}`);
          }
        }
        
        const finalizacao = await new MacroFaseFinalizacao({
          logger,
          clienteApi: this.deps.clienteApi,
          apiUrl: this.deps.config.API_URL,
          userId: ctx.UserId,
        } as DependenciasFinalizacao).execute({
          tarefaAtual: ctx.tarefaAtual,
          novoStatus,
          mensagemFechamento: mensagemFinal,
        } as FinalizacaoInput);

        if (!finalizacao.sucesso) {
          await logger.erro('O Orquestrador falhou gravemente ao persistir a finalização da tarefa na API.');
        } else {
          await logger.info(`🎉 Ciclo da Tarefa [${ctx.tarefaAtual.id}] encerrado. Status Final: ${novoStatus}`);
        }
      }

    } catch (erroGlobal: unknown) {
      const msg = erroGlobal instanceof Error ? erroGlobal.message : String(erroGlobal);
      await logger.erro(`💥 Erro fatal não tratado no Orquestrador: ${msg}`);
    } finally {
      // Liberação de infraestrutura garante que o processo pai destrave a esteira
      if (!ctx.lockAtivo && !ctx.controle.processoFantasma) {
        await this.deps.servicoLock.releaseLock();
      }
    }
  }

  /**
   * Gera lista de arquivos para o arquiteto seguindo lógica do sistema legado
   * Filtra por domínio (frontend/backend/fullstack) e aplica filtros inteligentes
   */
  private gerarListaArquivosParaArquiteto(
    snapshotInicial: Snapshot,
    tarefa: TarefaCompleta,
    project?: Project | null
  ): string[] {
    // Converter snapshot para array de caminhos
    let fileList = Array.from(snapshotInicial.keys());
    
    // Aplicar filtro de domínio seguindo lógica do SetupContextStep legado
    const domain = tarefa.domain?.toUpperCase();
    
    if (domain === 'FRONTEND' && project?.frontendPath) {
      const originalCount = fileList.length;
      fileList = fileList.filter(file => 
        file.includes(project.frontendPath) ||
        file.includes('shared') ||
        !file.includes('/')
      );
      this.deps.logger.info(`🎯 Tarefa FRONTEND: Lista reduzida de ${originalCount} para ${fileList.length} arquivos.`);
    } else if (domain === 'BACKEND' && project?.backendPath) {
      const originalCount = fileList.length;
      fileList = fileList.filter(file => 
        file.includes(project.backendPath) ||
        file.includes('prisma') ||
        file.includes('shared') ||
        !file.includes('/')
      );
      this.deps.logger.info(`🎯 Tarefa BACKEND: Lista reduzida de ${originalCount} para ${fileList.length} arquivos.`);
    } else {
      this.deps.logger.info(`🌍 Tarefa FULLSTACK ou domínio não especificado: Enviando todos os ${fileList.length} arquivos.`);
    }
    
    return fileList;
  }

  


}

