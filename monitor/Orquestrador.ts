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
import { VerificaDominioInput, VerificaDominioOutput, DependenciasVerificaDominio } from './passos/atomicos/PassoVerificaDominio';
import { WorkspaceSnapshotServiceDeps, SnapshotInput, Snapshot, WorkspaceSnapshotService } from './services/WorkspaceSnapshotService';
import { ConfiguraUsuarioOutput, DependenciasConfiguraUsuario, PassoConfiguraUsuario } from './passos/atomicos/PassoConfiguraUsuario';
import { BuscaTarefaInput, BuscaTarefaOutput, DependenciasBuscaTarefa, PassoBuscaTarefa } from './passos/atomicos/PassoBuscaTarefa';
import { InicializaTarefaOutput, PassoInicializaTarefa } from './passos/atomicos/PassoInicializaTarefa';
import { DependenciasSuperValidacao, PassoSuperValidacao, SuperValidacaoInput, SuperValidacaoOutput } from './passos/atomicos/PassoSuperValidacao';
import { PassoDecompoeTarefa, DecompoeTarefaOutput } from './passos/atomicos/PassoDecompoeTarefa';
import { PassoVerificaDominio } from './passos/atomicos/PassoVerificaDominio';
import PassoVerificaAtomicidade from './passos/atomicos/PassoVerificaAtomicidade';
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
import { ArquitetoOutput, PassoArquiteto } from './passos/atomicos/PassoArquiteto';
import passoPreAnaliseEscopoTarefa from './passos/atomicos/PassoPreAnaliseEscopoTarefa';
import PromptFactory from '../src/utils/promptFactory';
import { UniversalAgentEngine } from './services/universalEngine/universalAgentEngine';
import { retornoTipoDaTarefaType, VerificaAtomicidadeOutput } from './interfaces/retornosIA';
import TaskService from '../src/services/taskService';


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
  servicoOpenClaw: any;
  servicoDisco: any;
  servicoSnapshot: WorkspaceSnapshotService;
  servicoLlmAuxiliar?: any; // Para determinar domínio
  servicoLlmAtomicidade?: any; // Para determinar atomicidade
  jsonValidator: any;
  fabricaPrompts?: any; // Para gerar prompts
  // Novos serviços para feedback iterativo (TODOs 4 e 6)
  sessionManager?: SessionManager;
  feedbackService?: FeedbackService;
  motorUniversal?: UniversalAgentEngine;
  // utils
  criarContexto: () => ContextoExecucao;
  servicoTarefas: any
}

export class OrquestradorTarefas {
  
  constructor(private readonly deps: DependenciasGlobais) {
    
  }

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
        const configUsuario: ConfiguraUsuarioOutput = await new PassoConfiguraUsuario({
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
        ctx.project = busca.tarefa.project;
        ctx.configIA = { agentId: ctx.project.agent } as any;
        await logger.info(`🎯 Tarefa selecionada: ${ctx.tarefaAtual.title} [${ctx.tarefaAtual.id}]`);
      }

      // PASSO 4: INICIALIZAÇÃO DA TAREFA
      // TODO: Retirar diretório de trabalho isolado (taskDir)
      // Vamos trabalhar com JSONS (Pensar antes de implementar)
      {
        const inicializacao: InicializaTarefaOutput = await new PassoInicializaTarefa({
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
        const preanalise: retornoTipoDaTarefaType = await new passoPreAnaliseEscopoTarefa(this.deps).execute(ctx);

        if (!preanalise) {
          return; // Falha grave de FileSystem
        }
        if (preanalise.success === false) {
          return;
        }
        if (preanalise.taskType === null) {
          return;
        }

        ctx.outputPassos.preanalise = preanalise || null;
      }

      // PASSO 6: DETERMINAÇÃO DE ATOMICIDADE // RODA APENAS SE FOR DO TIPO DEVELOPMENT
      {
        if (ctx.outputPassos.preanalise?.taskType === 'development') {
          const verificacaoAtomicidade: VerificaAtomicidadeOutput = await new PassoVerificaAtomicidade(this.deps).execute(ctx);
          if (!verificacaoAtomicidade) {
            return; // Falha grave de FileSystem
          }
          if (verificacaoAtomicidade.success === false) {
            return;
          }
          if (verificacaoAtomicidade.isIdeal === null) {
            return;
          }
          if (verificacaoAtomicidade.isIdeal) {
            ctx.tarefaAtual.isAtomic = true;
            ctx.outputPassos.verificacaoAtomicidade = verificacaoAtomicidade;
            await this.deps.servicoTarefas.atualizarTarefa(ctx.tarefaAtual);
          }       
        }
      }

      // PASSO 7: DECOMPOSIÇÃO // RODA APENAS SE FOR DO TIPO DEVELOPMENT
      {
        if (ctx.outputPassos.preanalise?.taskType === 'development' && ctx.tarefaAtual.isAtomic === false) {
          const decomposicao: DecompoeTarefaOutput = await new PassoDecompoeTarefa(this.deps).execute(ctx);

          if (!decomposicao.success) {
            await logger.erro('IA falhou ao decompor tarefa.');
            return;
          }

          if (decomposicao.precisaDividir && decomposicao.subtarefas.length > 0) {
            await logger.info(`🎯 Tarefa decomposta em ${decomposicao.subtarefas.length} subtarefas. Persistindo no banco...`);
            for (const sub of decomposicao.subtarefas) {
              await this.deps.servicoTarefas.createTask({
                title: sub.title,
                description: sub.description,
                projectId: ctx.tarefaAtual.projectId,
                priorityId: ctx.tarefaAtual.priorityId,
                statusId: ctx.tarefaAtual.statusId,
                createdById: ctx.UserId,
                assignedToId: ctx.tarefaAtual.assignedToId,
                parentTaskId: ctx.tarefaAtual.id,
                domain: sub.domain,
                deadline: ctx.tarefaAtual.deadline,
              });
            }
            await logger.info("✅ Todas as subtarefas foram criadas. Encerrando execução da tarefa pai.");
            return; // Tarefa mãe virou épico
          }
          
          ctx.tarefaAtual.isAtomic = true; 
          ctx.outputPassos.decomposicaoTarefa = decomposicao;
        }
      }

      // PASSO 8: DETERMINAÇÃO DE DOMÍNIO
      {
        if (ctx.outputPassos.preanalise?.taskType === 'development') {
          if (!ctx.tarefaAtual.domain) {
            const dominio = await new PassoVerificaDominio(this.deps as any).execute(ctx);

            if (!dominio.dominioValido) return;
            if (dominio.dominio) ctx.tarefaAtual.domain = dominio.dominio;
            await this.deps.servicoTarefas.updateTask(ctx.tarefaAtual.id, { domain: dominio.dominio });
          }
        }
      }

      // CAPTURA DO SNAPSHOT INICIAL (Pré-Arquiteto)
      {
        if (ctx.outputPassos.preanalise?.taskType === 'development') {
          const snapshotService = new WorkspaceSnapshotService({ logger, fileSystem: this.deps.fileSystem } as WorkspaceSnapshotServiceDeps);
          ctx.initialSnapshot = await snapshotService.takeSnapshot({ dir: this.deps.config.BASE_DIR } as SnapshotInput);
        }
      }

      // PASSO 9: FASE DO ARQUITETO
      {
        if (ctx.outputPassos.preanalise?.taskType === 'development') {
          const passoArquiteto = new PassoArquiteto(this.deps as any);
          const resultadoArquiteto: ArquitetoOutput = await passoArquiteto.execute(ctx);
          
          if (!resultadoArquiteto || !resultadoArquiteto.success) {
            await logger.erro('IA falhou na fase do arquiteto: ' + (resultadoArquiteto?.error || 'Retorno nulo'));
            return;
          }

          ctx.resultados.arquiteto = resultadoArquiteto;

          if (resultadoArquiteto.isFullyImplemented) {
            fluxoEncerradoPrematuramente = true;
            mensagemFinal = '✅ Tarefa concluída integralmente pelo arquiteto (isFullyImplemented).';
            novoStatus = ctx.config.STATUS.COMPLETED;
          }
        }
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
        const planoParaProgramador = ctx.resultados.arquiteto.planDetails || ctx.tarefaAtual.description;
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
