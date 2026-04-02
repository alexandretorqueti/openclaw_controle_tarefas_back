
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
import { DecomposicaoInput, DecomposicaoOutput } from './passos/atomicos/PassoDecompoeTarefa';
import { VerificaDominioInput, VerificaDominioOutput, DependenciasVerificaDominio } from './passos/atomicos/PassoVerificaDominio';
import { WorkspaceSnapshotServiceDeps, SnapshotInput, Snapshot, WorkspaceSnapshotService } from './services/WorkspaceSnapshotService';
import { ConfiguraUsuarioOutput, DependenciasConfiguraUsuario, PassoConfiguraUsuario } from './passos/atomicos/PassoConfiguraUsuario';
import { BuscaTarefaInput, BuscaTarefaOutput, DependenciasBuscaTarefa, PassoBuscaTarefa } from './passos/atomicos/PassoBuscaTarefa';
import { InicializaTarefaOutput, PassoInicializaTarefa } from './passos/atomicos/PassoInicializaTarefa';
import { DependenciasSuperValidacao, PassoSuperValidacao, SuperValidacaoInput, SuperValidacaoOutput } from './passos/atomicos/PassoSuperValidacao';
import { DependenciasDecompoeTarefa, LogicaDecomposicao } from './passos/atomicos/PassoDecompoeTarefa';
import { PassoVerificaDominio } from './passos/atomicos/PassoVerificaDominio';
import { PassoVerificaAtomicidade, VerificaAtomicidadeOutput } from './passos/atomicos/PassoVerificaAtomicidade';
import { DependenciasFaseArquiteto, FaseArquitetoInput, FaseArquitetoOutput, MacroFaseArquiteto } from './passos/macro/FaseArquiteto';
import { DependenciasAnaliseArquiteto, AnaliseArquitetoInput, AnaliseArquitetoOutput, MacroFaseAnaliseArquiteto } from './passos/macro/FaseAnaliseArquiteto';
import { DependenciasFaseProgramador, FaseProgramadorInput, FaseProgramadorOutput, MacroFaseProgramador } from './passos/macro/FaseProgramador';
import { DependenciasAnaliseProgramador, AnaliseProgramadorInput, AnaliseProgramadorOutput, MacroFaseAnaliseProgramador } from './passos/macro/FaseAnaliseProgramador';
import { FinalizacaoInput, FinalizacaoOutput, MacroFaseFinalizacao } from './passos/macro/FaseFinaliza';
import { DependenciasExecutarComando, ExecutarComandoInput, ExecutarComandoOutput, PassoExecutarComando } from './passos/atomicos/PassoExecutarComando';
import { FabricaPromptsIA } from './utils/FabricaPrompts';
import { DependenciasBase } from './passos';
import { DependenciasFinalizacao } from './passos/macro/FaseFinaliza';
import { DoneFileServiceDeps } from './services/DoneFileService';
import { EvidenceServiceDeps } from './services/EvidenceService';
import { DependenciasInspecaoWorkspace, MacroFaseInspecaoWorkspace } from './passos/macro/FaseInspecaoWorkspace';

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
  // utils
  criarContexto: () => ContextoExecucao;
}

export class OrquestradorTarefas {
  constructor(private readonly deps: DependenciasGlobais) {}

  /**
   * O fluxo mestre do Jarbas.
   * Lemos este método de cima para baixo. Cada if/while
   * conta a história do ciclo de vida de uma tarefa.
   */
  public async executarCicloDaTarefa(): Promise<void> {
    const logger = this.deps.logger;
    const ctx = this.deps.criarContexto();

    try {
      // ==========================================================
      // FASE 1: PREPARAÇÃO DO AMBIENTE (Boot)
      // ==========================================================

      await logger.debug('🔄 Iniciando ciclo...');

      const lockStatus : VerificaLockOutput = await new PassoVerificaLock({
        logger,
        lockService: this.deps.servicoLock,
        stateService: this.deps.servicoEstado,
        } as DependenciasVerificaLock
      ).execute(
        { timeoutMs: ctx.config.TASK_TIMEOUT_MS } as VerificaLockInput
      );

      // Atualizamos o contexto centralizadamente
      ctx.lockAtivo = lockStatus.lockAtivo;

      if (ctx.lockAtivo) {
        return; // Lock recente e válido: encerra o ciclo.
      }

      if (lockStatus.processoFantasmaPid) {
        ctx.controle.processoFantasma = { pid: lockStatus.processoFantasmaPid } as ProcessoFantasma;
          await new PassoVerificaTimeout(
          { logger } as DependenciasBase
        )
        .execute(
          { 
            processoFantasmaPid: lockStatus.processoFantasmaPid 
          } as VerificaTimeoutInput
        );
        return; // Eject: Intervenção manual.
      }

      const configUsuario: ConfiguraUsuarioOutput = await new PassoConfiguraUsuario({
        logger,
        userService: this.deps.servicoUsuario,
      } as DependenciasConfiguraUsuario)
      .execute({ nickname: ctx.config.MY_USER_NICKNAME } as ConfiguraUsuarioInput);

      ctx.UserId = configUsuario.userId;

      // ==========================================================
      // FASE 2: CAPTURA E INICIALIZAÇÃO
      // ==========================================================

      const captura: BuscaTarefaOutput = await new PassoBuscaTarefa({
        logger,
        buscadorTarefa: this.deps.servicoBusca,
      } as DependenciasBuscaTarefa).execute({ nickname: ctx.config.MY_USER_NICKNAME } as BuscaTarefaInput);

      const tarefa = captura.tarefa;
      ctx.tarefaAtual = tarefa;

      if (!tarefa) {
        return; // Fila vazia: O trabalhador aguarda.
      }

      const inicializacao: InicializaTarefaOutput = await new PassoInicializaTarefa({
        logger,
        lockService: this.deps.servicoLock,
        stateService: this.deps.servicoEstado,
        fileSystem: this.deps.fileSystem,
        clienteApi: this.deps.clienteApi,
        path: this.deps.pathUtil,
      } as DependenciasInicializaTarefa).execute({
        tarefa,
        tasksDir: ctx.config.TASKS_DIR,
        apiUrl: ctx.config.API_URL,
        statusInProgress: ctx.config.STATUS.IN_PROGRESS,
      } as InicializaTarefaInput);

      if (!inicializacao.sucesso) {
        ctx.erros.inicializacao = true;
        return; // Falha grave no FileSystem ou Lock. Aborta.
      }
      
      ctx.controle.taskDir = inicializacao.taskDir;

      // ==========================================================
      // FASE 3: VALIDAÇÃO DE NEGÓCIO E ROTEAMENTO
      // ==========================================================

      const superValidacao : SuperValidacaoOutput = await new PassoSuperValidacao(
        { logger, taskAnalysisService: this.deps.servicoAnaliseTarefa } as DependenciasSuperValidacao 
      )
      .execute({ tarefa } as SuperValidacaoInput);

      if (!superValidacao.valido) {
        ctx.erros.fatalIA = true;
        return; // Tarefa malformada
      }
      
      ctx.analysisPlan = superValidacao.planoDeAnalise || null;

      // VERIFICAÇÃO DE ATOMICIDADE (se não definida no banco)
      let isAtomic = tarefa.isAtomic;
      if (isAtomic === undefined || isAtomic === null) {
        const passoAtomicidade: PassoVerificaAtomicidade = new PassoVerificaAtomicidade(
        {
          logger,
          servicoLlmAtomicidade: this.deps.servicoLlmAtomicidade,
          fabricaPrompts: FabricaPromptsIA,
        } as DependenciasVerificaAtomicidade);

        const resultadoAtomicidade: VerificaAtomicidadeOutput = await passoAtomicidade
        .execute({ tarefa } as VerificaAtomicidadeInput);
        isAtomic = resultadoAtomicidade.isAtomic;
        
        // Armazena no contexto para uso posterior
        ctx.tarefaAtual.isAtomic = isAtomic;
        
        await logger.info(
          `🔍 Atomicidade determinada: ${isAtomic ? 'ATÔMICA' : 'NÃO ATÔMICA'} ` +
          `(Certeza: ${resultadoAtomicidade.certeza}%)`
        );
      }

      // DECOMPOSIÇÃO: Se for uma "Epic" (não atômica)
      if (isAtomic === false) {
        const passoDecomposicao: LogicaDecomposicao = new LogicaDecomposicao({
          logger,
          analista: this.deps.servicoAnalista,
        } as DependenciasDecompoeTarefa);

        const promptDecomposicao : string = FabricaPromptsIA.gerarPromptDecomposicao(tarefa as TarefaCompleta);

        // Executamos o passo puro
        const resultDecomposicao: DecomposicaoOutput = await passoDecomposicao.execute({
          tarefaAtual: tarefa as TarefaCompleta,
          userId: ctx.UserId,
          prompt: promptDecomposicao,
        } as DecomposicaoInput);

        if (resultDecomposicao.sucesso && resultDecomposicao.quantidadeSubtarefas === 0) {
          ctx.erros.decomposicao = false;
          ctx.tarefaAtual.isAtomic = true; // Marca a tarefa como atômica para evitar futuras tentativas de decomposição
          await logger.erro('A IA decidiu não decompor a tarefa. A tarefa é atômica, segue fluxo normal.');
        }

        // Mutações explícitas
        if (!resultDecomposicao.sucesso) {
          ctx.erros.decomposicao = true;
          await logger.erro('IA falhou ao decompor tarefa. Abortando esteira.');
          return; // Deu erro na IA, para o fluxo.
        }

        // Sucesso total na decomposição: A mãe não precisa ser executada (subtasks criadas)
        if (resultDecomposicao.sucesso && resultDecomposicao.quantidadeSubtarefas > 0) {
          return; 
        }
      }

      // VERIFICAÇÃO DE DOMÍNIO
      const dominio: VerificaDominioOutput = await new PassoVerificaDominio({
        logger,
        gerenciadorFalha: this.deps.gerenciadorFalha,
        servicoLlmAuxiliar: this.deps.servicoLlmAuxiliar,
        fabricaPrompts: FabricaPromptsIA,
      } as DependenciasVerificaDominio).execute(
      {
        tarefa,
        userId: ctx.UserId,
        configFalha: {
          apiUrl: ctx.config.API_URL,
          tasksDir: ctx.config.TASKS_DIR,
          errorDir: ctx.config.ERROR_DIR,
        },
      } as VerificaDominioInput);

      if (!dominio.dominioValido) {
        ctx.erros.dominio = true;
        return; // Eject: Tarefa atômica sem domínio.
      }

      // Se domínio foi determinado pela LLM, armazena no contexto
      if (dominio.dominio) {
        ctx.tarefaAtual.domain = dominio.dominio;
        await logger.info(`✅ Domínio armazenado no contexto: ${dominio.dominio}`);
      }

      // ==========================================================
      // FASE 4: ESTEIRA DA IA (Arquiteto e Programador)
      // ==========================================================

      await logger.info(`🚀 Tarefa [${tarefa.id}] validada e pronta para a IA! (Fase 4)`);

      const caminhoPlanoParaSalvar: string = this.deps
      .pathUtil.join
      (
        ctx.controle.taskDir || '' as string, `${tarefa.id}_architect_plan.json` as string
      );

      // CAPTURAR SNAPSHOT INICIAL (antes do analista)
      await logger.info('📸 Capturando snapshot inicial do workspace...');
      const snapshotService: WorkspaceSnapshotService = new WorkspaceSnapshotService({
        logger,
        fileSystem: this.deps.fileSystem,
      } as WorkspaceSnapshotServiceDeps);
      const snapshotInicial: Snapshot = await snapshotService.takeSnapshot({ dir: this.deps.config.BASE_DIR } as SnapshotInput);
      ctx.initialSnapshot = snapshotInicial;
      await logger.info(`✅ Snapshot inicial capturado: ${snapshotInicial.size} arquivos`);


      // PASSO DO ARQUITETO (Macro Passo)
      const passoArquiteto: MacroFaseArquiteto = new MacroFaseArquiteto({
        logger,
        openClaw: this.deps.servicoOpenClaw,
        disco: this.deps.servicoDisco,
        jsonValidator: this.deps.jsonValidator,
      } as DependenciasFaseArquiteto);

      // GERAR LISTA DE ARQUIVOS E SEÇÃO DE COMENTÁRIOS (seguindo lógica do legado)
      const listaArquivos: string[] = this.gerarListaArquivosParaArquiteto(
        snapshotInicial,
        tarefa as TarefaCompleta,
        ctx.tarefaAtual.project
      );
      
      const secaoComentarios: string = this.gerarSecaoComentariosParaArquiteto(
        tarefa as TarefaCompleta
      );

      const promptArquiteto: string = FabricaPromptsIA.gerarPromptArquiteto(
        tarefa as TarefaCompleta,
        ctx.tarefaAtual.project,
        caminhoPlanoParaSalvar,
        ctx.analysisPlan?.taskType || 'development',
        listaArquivos,
        secaoComentarios
      );

      const resultArquiteto: FaseArquitetoOutput = await passoArquiteto.execute({
        tarefaAtual: tarefa,
        planoAnalise: ctx.analysisPlan,
        promptInicial: promptArquiteto,
        caminhoPlanoParaSalvar,
      } as FaseArquitetoInput);

      if (!resultArquiteto.sucesso) {
        await logger.erro('O Arquiteto falhou criticamente.');
        return; // Eject
      }

      await logger.info('🔍 Analisando resposta do arquiteto...');
      const dependenciasAnaliseArquiteto : DependenciasAnaliseArquiteto = {
        logger,
        snapshot: this.deps.servicoSnapshot,
        fileSystem: this.deps.fileSystem,
      }
      // FASE DE ANÁLISE DO ARQUITETO (Nova fase)
      const passoAnaliseArquiteto: MacroFaseAnaliseArquiteto = new MacroFaseAnaliseArquiteto(dependenciasAnaliseArquiteto);
      const analiseArquitetoInput: AnaliseArquitetoInput = {
        tarefaAtual: tarefa,
        planoAnalise: ctx.analysisPlan,
        respostaArquiteto: resultArquiteto.planDetails || '',
        caminhoPlanoArquiteto: caminhoPlanoParaSalvar,
        snapshotInicial,
        diretorioBase: this.deps.config.BASE_DIR,
      };
      const analiseArquiteto: AnaliseArquitetoOutput = await passoAnaliseArquiteto.execute(analiseArquitetoInput);

      if (!analiseArquiteto.sucesso) {
        await logger.erro('A análise do arquiteto falhou. Parando execução...');
        return;
        // Fallback: passa para programador mesmo com erro
      }

      // DECISÃO DE FLUXO BASEADA NA ANÁLISE
      if (analiseArquiteto.hasRealChanges && analiseArquiteto.existsDoneFile) {
        // Pular programador e ir direto para análise/finalização
        const mensagemFinal = `✅ Tarefa executada pelo arquiteto: Implementação concluída'}`;
        return await this.finalizarTarefa(ctx, tarefa, mensagemFinal, logger);
      }

      if (!analiseArquiteto.existsPlanoFile) {
        await logger.erro('O plano do arquiteto não foi encontrado. Parando execução...');
        return; // Eject: Plano do arquiteto é essencial para o programador.
      }

      const planoArquiteto = await this.deps.fileSystem.readFile(caminhoPlanoParaSalvar, 'utf-8');

      await logger.info(`📋 Arquiteto gerou plano). Passando para programador.`);

      // PASSO DO PROGRAMADOR (Macro Passo)
      const passoProgramador : MacroFaseProgramador = new MacroFaseProgramador({
        logger,
        openClaw: this.deps.servicoOpenClaw,
        jsonValidator: this.deps.jsonValidator,
        config: this.deps.config,
      } as DependenciasFaseProgramador);

      // Usar plano do arquiteto ou descrição original se análise falhou
      const planoParaProgramador = planoArquiteto || resultArquiteto.planDetails || tarefa.description;
      
      const promptProgramador: string = FabricaPromptsIA.gerarPromptProgramador(
        tarefa as TarefaCompleta,
        planoParaProgramador,
        ctx.controle.taskDir || '' as string
      );

      const resultProgramador: FaseProgramadorOutput = await passoProgramador.execute({
        tarefaAtual: tarefa,
        planoArquiteto: promptProgramador,
      } as FaseProgramadorInput);

      if (!resultProgramador.sucesso) {
        await logger.erro('O Programador falhou ou estourou o limite de turnos.');
        return; // Eject
      }

      // Salvar informações do programador no contexto para análise
      if (!ctx.resultados) ctx.resultados = {};
      if (!ctx.resultados.programador) ctx.resultados.programador = {};
      
      ctx.resultados.programador.rawOutput = resultProgramador.rawOutput;
      ctx.resultados.programador.toolCall = resultProgramador.toolCall;
      ctx.resultados.programador.toolResult = resultProgramador.toolResult;

      // ==========================================================
      // FASE 5: INSPEÇÃO, BUILDS E TESTES
      // ==========================================================

      await logger.info(`🔎 Programador declarou que terminou. Inspecionando o trabalho...`);
      
      // Criar serviços de inspeção
      // Adapter para o módulo path (pathUtil -> path)
      const pathAdapter = {
        join: (...parts: string[]) => {
          if (typeof this.deps.pathUtil?.join === 'function') {
            return this.deps.pathUtil.join(...parts);
          }
          // Fallback simples se pathUtil não tiver join
          return parts.join('/');
        }
      };
      
      const doneFileServiceDeps : DoneFileServiceDeps = {
        logger,
        fileSystem: this.deps.fileSystem,
        path: this.deps.pathUtil
      }
      // Criar serviços de inspeção
      const doneFileService = new (await import('./services/DoneFileService')).DoneFileService(doneFileServiceDeps);
            

      const evidenceServiceDeps : EvidenceServiceDeps = {
        logger
      }
      const evidenceService = new (await import('./services/EvidenceService')).EvidenceService(evidenceServiceDeps);
      
      const macroFaseInspecaoWorkspaceDeps : DependenciasInspecaoWorkspace = {
        logger,
        snapshotService: this.deps.servicoSnapshot,
        doneFileService,
        evidenceService
      }
      // Criar fase de inspeção do workspace
      const faseInspecaoWorkspace : MacroFaseInspecaoWorkspace = new (await import('./passos/macro/FaseInspecaoWorkspace')).MacroFaseInspecaoWorkspace(macroFaseInspecaoWorkspaceDeps);
      
      // Criar fase de análise do programador (usando inspeção completa)
      const analisadorDisco : MacroFaseAnaliseProgramador = new MacroFaseAnaliseProgramador({
        logger,
        inspecaoWorkspace: faseInspecaoWorkspace
      } as DependenciasAnaliseProgramador);

      const analise: AnaliseProgramadorOutput = await analisadorDisco.execute({
        tarefaAtual: tarefa,
        caminhoTaskDir: ctx.controle.taskDir || '',
        snapshotInicial,
        diretorioBase: this.deps.config.BASE_DIR,
        rawOutput: ctx.resultados?.programador?.rawOutput,
        toolCall: ctx.resultados?.programador?.toolCall,
        toolResult: ctx.resultados?.programador?.toolResult
      } as AnaliseProgramadorInput);

      let mensagemFinal = 'Trabalho do Programador rejeitado (nenhuma mudança confirmada).';
      let novoStatus = ctx.config.STATUS.IN_PROGRESS;
      let manterSessao = false;
      let feedbackParaProgramador = '';

      // Inicializar controle de sessão se necessário
      if (!ctx.controle.tentativasCorrecao) {
        ctx.controle.tentativasCorrecao = 0;
        ctx.controle.maxTentativasCorrecao = 3; // Máximo de 3 tentativas de correção
      }

      if (analise.workspaceValidado) {
        // RODA OS BUILDS E TESTES
        const executor: PassoExecutarComando = new PassoExecutarComando({ 
          logger,
          terminal: {
            executar: async (comando, opcoes) => {
              const { exec } = require('child_process');
              const { promisify } = require('util');
              const execAsync = promisify(exec);
              return execAsync(comando, opcoes);
            }
          }
        } as DependenciasExecutarComando);
        
        await logger.info('🔨 Iniciando rotina de Build/Lint...');
        const build: ExecutarComandoOutput = await executor.execute({
          comando: 'npm run build', // ou tsc --noEmit, dependendo do repositório configurado
          diretorioDeTrabalho: this.deps.config.BASE_DIR, 
        } as ExecutarComandoInput);

        await logger.info('🧪 Iniciando rotina de Testes Automatizados...');
        const testes = await executor.execute({
          comando: 'npm run test',
          diretorioDeTrabalho: this.deps.config.BASE_DIR, 
        } as ExecutarComandoInput);

        if (build.sucesso && testes.sucesso) {
          mensagemFinal = `✅ Tudo verde! Código passou em todos os testes e builds.\n\nLogs:\n${testes.stdout.substring(0, 500)}...`;
          novoStatus = ctx.config.STATUS.COMPLETED;
          // Sessão pode ser encerrada
          ctx.controle.sessaoAtiva = false;
          ctx.controle.feedbackPendente = null;
          ctx.controle.instrucoesCorrecao = null;
        } else {
          // Cenário c: Build ou testes falharam
          const erroBuild = !build.sucesso ? `Build falhou:\n${build.stderr?.substring(0, 500) || 'Erro desconhecido'}` : '';
          const erroTestes = !testes.sucesso ? `Testes falharam:\n${testes.stderr?.substring(0, 500) || 'Erro desconhecido'}` : '';
          
          mensagemFinal = `❌ O código falhou na esteira de CI/CD local!\n${erroBuild}${erroTestes}`;
          
          // Preparar feedback específico para o programador
          feedbackParaProgramador = `O sistema não está buildando/testando corretamente.\n\n`;
          if (!build.sucesso) {
            feedbackParaProgramador += `**Erro de build:**\n\`\`\`\n${build.stderr?.substring(0, 300) || 'Erro desconhecido'}\n\`\`\`\n`;
          }
          if (!testes.sucesso) {
            feedbackParaProgramador += `**Erro de testes:**\n\`\`\`\n${testes.stderr?.substring(0, 300) || 'Erro desconhecido'}\n\`\`\`\n`;
          }
          feedbackParaProgramador += `\nPor favor, corrija os erros acima e tente novamente.`;
          
          // Atualizar análise com informações de falha de build/teste
          analise.precisaCorrecao = true;
          analise.tipoFalha = !build.sucesso ? 'BUILD_FALHOU' : 'TESTES_FALHARAM';
          analise.mensagemCorrecao = feedbackParaProgramador;
          analise.manterSessao = true;
          manterSessao = true;
        }
      } else if (analise.precisaCorrecao) {
        // Cenários a, b, d: Precisa de correção específica
        ctx.controle.tentativasCorrecao += 1;
        
        if (ctx.controle.tentativasCorrecao <= ctx.controle.maxTentativasCorrecao!) {
          // Ainda há tentativas disponíveis
          await logger.info(`🔄 Tentativa de correção ${ctx.controle.tentativasCorrecao}/${ctx.controle.maxTentativasCorrecao} para o programador.`);
          
          feedbackParaProgramador = `${analise.mensagemCorrecao}\n\n${analise.instrucoesEspecificas || ''}`;
          manterSessao = analise.manterSessao || true;
          
          // Armazenar feedback para enviar ao programador
          ctx.controle.feedbackPendente = feedbackParaProgramador;
          ctx.controle.instrucoesCorrecao = analise.instrucoesEspecificas;
          ctx.controle.sessaoAtiva = true;
          
          mensagemFinal = `🔄 Correção solicitada: ${analise.tipoFalha}. Tentativa ${ctx.controle.tentativasCorrecao}/${ctx.controle.maxTentativasCorrecao}`;
          novoStatus = ctx.config.STATUS.IN_PROGRESS; // Mantém em progresso
        } else {
          // Esgotou tentativas de correção
          await logger.erro(`❌ Esgotadas ${ctx.controle.maxTentativasCorrecao} tentativas de correção. Encerrando tarefa.`);
          
          mensagemFinal = `❌ Tarefa rejeitada após ${ctx.controle.maxTentativasCorrecao} tentativas de correção.\nÚltimo erro: ${analise.mensagemCorrecao}`;
          novoStatus = ctx.config.STATUS.FAILED; // Marca como falha
          ctx.controle.sessaoAtiva = false;
          ctx.controle.feedbackPendente = null;
          ctx.controle.instrucoesCorrecao = null;
        }
      }

      // ==========================================================
      // FASE 6: FINALIZAÇÃO OU CONTINUAÇÃO DA SESSÃO
      // ==========================================================

      if (!manterSessao) {
        // Encerrar sessão e finalizar tarefa
        const passoFinaliza: MacroFaseFinalizacao = new MacroFaseFinalizacao({
        logger,
        clienteApi: this.deps.clienteApi,
        apiUrl: this.deps.config.API_URL,
        userId: ctx.UserId,
      } as DependenciasFinalizacao);

        const finalizacao: FinalizacaoOutput = await passoFinaliza.execute({
          tarefaAtual: tarefa,
          novoStatus,
          mensagemFechamento: mensagemFinal,
        } as FinalizacaoInput);

        if (!finalizacao.sucesso) {
          await logger.erro('O Orquestrador falhou ao finalizar a tarefa.');
          return; // Eject
        }
      } else {
        // Sessão precisa ser mantida para correção
        await logger.info(`🔄 Mantendo sessão ativa para correção. Feedback pendente: ${ctx.controle.feedbackPendente?.substring(0, 100)}...`);
        
        // Aqui precisaríamos integrar com o sistema de sessões do OpenClaw
        // Por enquanto, apenas logamos que a sessão deveria ser mantida
        await logger.info(`💡 Para implementação completa: integrar com sistema de sessões do OpenClaw para manter sessão ${ctx.controle.sessaoId || 'não definida'} ativa.`);
        
        // Em um sistema real, aqui enviaríamos o feedbackParaProgramador de volta para a sessão do OpenClaw
        if (feedbackParaProgramador) {
          await logger.info(`📤 Feedback para programador (simulado):\n${feedbackParaProgramador.substring(0, 300)}...`);
        }
      }
      
      // Se chegamos aqui, o ciclo dessa tarefa chegou ao fim!
      await logger.info(`🎉 Ciclo da Tarefa [${tarefa.id}] completamente finalizado!`);

    } catch (erroGlobal: unknown) {
      const msg = erroGlobal instanceof Error ? erroGlobal.message : String(erroGlobal);
      await logger.erro(`💥 Erro fatal não tratado no Orquestrador: ${msg}`);
    } finally {
      // TEARDOWN (Liberação do Lock)
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

  /**
   * Gera seção de comentários para o arquiteto seguindo lógica do sistema legado
   */
  private gerarSecaoComentariosParaArquiteto(tarefa: TarefaCompleta): string {
    let commentsSection = '';
    
    if (tarefa.comments && tarefa.comments.length > 0) {
      commentsSection = '\n\n=== COMENTÁRIOS DA TAREFA ===\n';
      tarefa.comments.forEach((comment, index) => {
        const userInfo = comment.user ? `${comment.user.name} (${comment.user.nickname})` : 'Usuário';
        const timestamp = new Date(comment.createdAt).toLocaleString('pt-BR');
        commentsSection += `\n${index + 1}. [${timestamp}] ${userInfo}: ${comment.content}`;
      });
      this.deps.logger.info(`💬 ${tarefa.comments.length} comentários incluídos no contexto do arquiteto`);
    }
    
    return commentsSection;
  }

  /**
   * Método auxiliar para finalizar tarefa quando arquiteto já executou
   */
  private async finalizarTarefa(
    ctx: ContextoExecucao,
    tarefa: TarefaCompleta,
    mensagemFinal: string,
    logger: Logger
  ): Promise<void> {
    await logger.info(`🚀 Finalizando tarefa executada pelo arquiteto...`);

    // Pular análise do programador e ir direto para finalização
    const passoFinaliza: MacroFaseFinalizacao = new MacroFaseFinalizacao({
      logger,
      clienteApi: this.deps.clienteApi,
      apiUrl: this.deps.config.API_URL,
      userId: ctx.UserId,
    } as DependenciasFinalizacao);

    const finalizacao: FinalizacaoOutput = await passoFinaliza.execute({
      tarefaAtual: tarefa,
      novoStatus: ctx.config.STATUS.COMPLETED,
      mensagemFechamento: mensagemFinal,
    } as FinalizacaoInput);

    if (!finalizacao.sucesso) {
      await logger.erro('Falha ao finalizar tarefa executada pelo arquiteto.');
    } else {
      await logger.info(`🎉 Tarefa [${tarefa.id}] finalizada pelo arquiteto!`);
    }
  }
}

