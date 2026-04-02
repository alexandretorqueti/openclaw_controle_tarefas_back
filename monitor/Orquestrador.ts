
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
    let mensagemFinal = '';
    let novoStatus = ctx.config.STATUS.IN_PROGRESS;
    let manterSessao = false;
    let feedbackParaProgramador = '';

    try {
      // ==========================================================
      // PASSO 1: PREPARAÇÃO DO AMBIENTE
      // ==========================================================
      // Verifica se tem Lock Ativo, dentro do timeout.
      // Caso positivo, aborta a tarefa.
      // Caso negativo, verifica se o lock é antigo (processo fantasma).
      // Se for fantasma, mata o processo fantasma e limpa o lock.
      // ==========================================================
      {
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
      }
      // ==========================================================
      // FIM DO PASSO 1
      // ==========================================================

      // ==========================================================
      // PASSO 2: CONFIGURAÇÃO DO USUÁRIO
      // Busca usuario de acordo com nickname
      // Estamos usando no env. o nickname jarbas
      // ==========================================================
      {
        const configUsuario: ConfiguraUsuarioOutput = await new PassoConfiguraUsuario({
          logger,
          userService: this.deps.servicoUsuario,
        } as DependenciasConfiguraUsuario)
        .execute({ nickname: ctx.config.MY_USER_NICKNAME } as ConfiguraUsuarioInput);
  
        ctx.UserId = configUsuario.userId;
      }
      // ==========================================================
      // FIM DO PASSO 2
      // ==========================================================


      // ==========================================================
      // PASSO 3: BUSCA TAREFA
      // Busca a primeira tarefa da fila
      // Status Pendente, no nickname jarbas, seguindo ordem de prioridade
      // ==========================================================
      {
        const captura: BuscaTarefaOutput = await new PassoBuscaTarefa({
          logger,
          buscadorTarefa: this.deps.servicoBusca,
        } as DependenciasBuscaTarefa).execute({ nickname: ctx.config.MY_USER_NICKNAME } as BuscaTarefaInput);

        ctx.tarefaAtual = captura.tarefa;

        if (!ctx.tarefaAtual) {
          return; // Fila vazia: O trabalhador aguarda.
        }
      }
      // ==========================================================
      // FIM DO PASSO 3
      // ==========================================================

      // ==========================================================
      // PASSO 4: INICIALIZAÇÃO DA TAREFA
      // Coloca a tarefa no status em andamento
      // coloca a tarefa em isExecution = true
      // Cria o arquivo de Lock
      // Atualiza o banco de dados
      // ==========================================================
      {
        const inicializacao: InicializaTarefaOutput = await new PassoInicializaTarefa({
          logger,
          lockService: this.deps.servicoLock,
          stateService: this.deps.servicoEstado,
          fileSystem: this.deps.fileSystem,
          clienteApi: this.deps.clienteApi,
          path: this.deps.pathUtil,
        } as DependenciasInicializaTarefa).execute({
          tarefa: ctx.tarefaAtual,
          tasksDir: ctx.config.TASKS_DIR,
          apiUrl: ctx.config.API_URL,
          statusInProgress: ctx.config.STATUS.IN_PROGRESS,
        } as InicializaTarefaInput);

        if (!inicializacao.sucesso) {
          ctx.erros.inicializacao = true;
          return; // Falha grave no FileSystem ou Lock. Aborta.
        }
        
        ctx.controle.taskDir = inicializacao.taskDir;
      }
      // ==========================================================
      // FIM DO PASSO 4
      // ==========================================================

      
      // ==========================================================
      // PASSO 5: SUPER VALIDAÇÃO
      // Usa um modelo de IA local para definir 
      // {
      //    "taskType": "development" | "analysis" | "automation",
      //    "requiresReport": true | false,
      //    "expectedLayers": ["frontend"],
      //    "requiredModifiedLayers": [],
      //    "mandatoryChecks": ["Verificar configurações", "Gerar relatório de descoberta"],
      //    "risks": ["Risco de não encontrar o arquivo de configuração"]
      //  }
      // ==========================================================
      {
        const superValidacao : SuperValidacaoOutput = await new PassoSuperValidacao(
          { logger, taskAnalysisService: this.deps.servicoAnaliseTarefa } as DependenciasSuperValidacao 
        )
        .execute({ tarefa: ctx.tarefaAtual } as SuperValidacaoInput);

        if (!superValidacao.valido) {
          ctx.erros.fatalIA = true;
          return; // Tarefa malformada
        }
        
        ctx.analysisPlan = superValidacao.planoDeAnalise || null;
      }
      // ==========================================================
      // FIM DO PASSO 5
      // ==========================================================


      // ==========================================================
      // PASSO 6: DETERMINAÇÃO DE ATOMICIDADE
      // Caso a tarefa não tenha a propriedade isAtomic definida, ou seja, seja desconhecida,
      // ou seja false, usamos IA para determinar se a tarefa é atômica ou uma "épica" que pode ser decomposta.
      // ==========================================================
      {
        let isAtomic = ctx.tarefaAtual.isAtomic;
        if (isAtomic === undefined || isAtomic === null) {
          const passoAtomicidade: PassoVerificaAtomicidade = new PassoVerificaAtomicidade(
          {
            logger,
            servicoLlmAtomicidade: this.deps.servicoLlmAtomicidade,
            fabricaPrompts: FabricaPromptsIA,
          } as DependenciasVerificaAtomicidade);

          const resultadoAtomicidade: VerificaAtomicidadeOutput = await passoAtomicidade
          .execute({ tarefa: ctx.tarefaAtual } as VerificaAtomicidadeInput);
          isAtomic = resultadoAtomicidade.isAtomic;
          
          // Armazena no contexto para uso posterior
          ctx.tarefaAtual.isAtomic = isAtomic;
          // TODO: Atualizar a tarefa no datbase
          await logger.info(
            `🔍 Atomicidade determinada: ${isAtomic ? 'ATÔMICA' : 'NÃO ATÔMICA'} ` +
            `(Certeza: ${resultadoAtomicidade.certeza}%)`
          );
        }
      }
      // ==========================================================
      // FIM DO PASSO 6
      // ==========================================================


      // ==========================================================
      // PASSO 7: DECOMPOSIÇÃO (se não for atômica)
      // Se a tarefa for atômica, pula esta fase e vai direto para a verificação de domínio.
      // Caso contrário, usa um modelo de IA local para decompor a tarefa em subtarefas.
      // A IA ainda pode considerar que a tarefa é sim atômica e não criar subtarefas.
      // ==========================================================
      {
        if (ctx.tarefaAtual.isAtomic === false) {
          const passoDecomposicao: LogicaDecomposicao = new LogicaDecomposicao({
            logger,
            analista: this.deps.servicoAnalista,
          } as DependenciasDecompoeTarefa);

          const promptDecomposicao : string = FabricaPromptsIA.gerarPromptDecomposicao(ctx.tarefaAtual);

          // Executamos o passo puro
          const resultDecomposicao: DecomposicaoOutput = await passoDecomposicao.execute({
            tarefaAtual: ctx.tarefaAtual,
            userId: ctx.UserId,
            prompt: promptDecomposicao,
          } as DecomposicaoInput);

          if (resultDecomposicao.sucesso && resultDecomposicao.quantidadeSubtarefas === 0) {
            ctx.erros.decomposicao = false;
            ctx.tarefaAtual.isAtomic = true; // Marca a tarefa como atômica para evitar futuras tentativas de decomposição
            // TODO: Atualizar a tarefa no datbase
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
      }
      // ==========================================================
      // FIM DO PASSO 7
      // ==========================================================


      // ==========================================================
      // PASSO 8: DETERMINAÇÃO DE DOMÍNIO
      // Caso a tarefa ainda não tenha domínio, usa um modelo de IA local para determinar o domínio.
      // ==========================================================
      {
        const dominio: VerificaDominioOutput = await new PassoVerificaDominio({
          logger,
          gerenciadorFalha: this.deps.gerenciadorFalha,
          servicoLlmAuxiliar: this.deps.servicoLlmAuxiliar,
          fabricaPrompts: FabricaPromptsIA,
        } as DependenciasVerificaDominio).execute(
        {
          tarefa: ctx.tarefaAtual,
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
          // TODO: Atualizar a tarefa no datbase
          await logger.info(`✅ Domínio armazenado no contexto: ${dominio.dominio}`);
        }
      }
      // ==========================================================
      // FIM DO PASSO 8
      // ==========================================================

     

      // ==========================================================
      // PASSO 9: FASE DO ARQUITETO REALIZAR A ANALISE
      // O analista irá analisar a tarefa, o plano de análise e o snapshot inicial para criar um plano detalhado de implementação.
      // O analista eventualmente pode decidir realizar a tarefa e não enviar para o programador
      // ==========================================================
      {
        await logger.info(`🚀 Tarefa [${ctx.tarefaAtual.id}] validada e pronta para a IA!`);

        const caminhoPlanoParaSalvar: string = this.deps
        .pathUtil.join
        (
          ctx.controle.taskDir || '' as string, `${ctx.tarefaAtual.id}_architect_plan.json` as string
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
          ctx.tarefaAtual,
          ctx.tarefaAtual.project
        );
        
        const secaoComentarios: string = this.gerarSecaoComentariosParaArquiteto(
          ctx.tarefaAtual
        );

        const promptArquiteto: string = FabricaPromptsIA.gerarPromptArquiteto(
          ctx.tarefaAtual,
          ctx.tarefaAtual.project,
          caminhoPlanoParaSalvar,
          ctx.analysisPlan?.taskType || 'development',
          listaArquivos,
          secaoComentarios
        );

        const resultArquiteto: FaseArquitetoOutput = await passoArquiteto.execute({
          tarefaAtual: ctx.tarefaAtual,
          planoAnalise: ctx.analysisPlan,
          promptInicial: promptArquiteto,
          caminhoPlanoParaSalvar,
        } as FaseArquitetoInput);

        ctx.resultados.resultArquiteto = {...resultArquiteto, caminhoPlanoSalvo: caminhoPlanoParaSalvar};

        if (!resultArquiteto.sucesso) {
          await logger.erro('O Arquiteto falhou criticamente.');
          return; // Eject
        }
      }
      // ==========================================================
      // FIM DO PASSO 9
      // ==========================================================

      // ==========================================================
      // PASSO 10: FASE DE ANÁLISE DO ARQUITETO
      // Usamos a IA para avaliar o que o arquiteto fez.
      // Caso ele tenha feito um plano, mandamos para o programador. Caso ele tenha
      // decidido implementar direto, vamos para a fase de inspeção/finalização.
      // ==========================================================
      {
        await logger.info('🔍 Analisando resposta do arquiteto...');
        const dependenciasAnaliseArquiteto : DependenciasAnaliseArquiteto = {
          logger,
          snapshot: this.deps.servicoSnapshot,
          fileSystem: this.deps.fileSystem,
        }
        // FASE DE ANÁLISE DO ARQUITETO (Nova fase)
        const passoAnaliseArquiteto: MacroFaseAnaliseArquiteto = new MacroFaseAnaliseArquiteto(dependenciasAnaliseArquiteto);
        const analiseArquitetoInput: AnaliseArquitetoInput = {
          tarefaAtual: ctx.tarefaAtual,
          planoAnalise: ctx.analysisPlan,
          respostaArquiteto: ctx.resultados.resultArquiteto?.planDetails || '',
          caminhoPlanoArquiteto: ctx.resultados.resultArquiteto?.caminhoPlanoSalvo || '',
          snapshotInicial: ctx.initialSnapshot,
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
          return await this.finalizarTarefa(ctx, ctx.tarefaAtual, mensagemFinal, logger);
        }

        if (!analiseArquiteto.existsPlanoFile) {
          await logger.erro('O plano do arquiteto não foi encontrado. Parando execução...');
          return; // Eject: Plano do arquiteto é essencial para o programador.
        }

        const planoArquiteto = await this.deps.fileSystem.readFile(ctx.resultados.resultArquiteto?.caminhoPlanoSalvo || '', 'utf-8');
        ctx.resultados.resultArquiteto.planoArquiteto = planoArquiteto;
        await logger.info(`📋 Arquiteto gerou plano). Passando para programador.`);
      }
      // ==========================================================
      // FIM DO PASSO 10
      // ==========================================================

      // ==========================================================
      // PASSO 11: FASE DO PROGRAMADOR
      // O programador irá receber o plano do arquiteto e implementar a solução.
      // Ele pode usar ferramentas (ex: acesso ao disco, terminal, etc) para isso.
      // O resultado do programador é o que ele fez (rawOutput), 
      // as ferramentas que usou (toolCall/toolResult) e um feedback textual (toolFeedback).
      // ==========================================================
      {
        const passoProgramador : MacroFaseProgramador = new MacroFaseProgramador({
          logger,
          openClaw: this.deps.servicoOpenClaw,
          jsonValidator: this.deps.jsonValidator,
          config: this.deps.config,
        } as DependenciasFaseProgramador);

        // Usar plano do arquiteto ou descrição original se análise falhou
        const planoParaProgramador = ctx.resultados.resultArquiteto.planoArquiteto || ctx.resultados.resultArquiteto.planDetails || ctx.tarefaAtual.description;
        
        const promptProgramador: string = FabricaPromptsIA.gerarPromptProgramador(
          ctx.tarefaAtual,
          planoParaProgramador,
          ctx.controle.taskDir || '' as string
        );

        const resultProgramador: FaseProgramadorOutput = await passoProgramador.execute({
          tarefaAtual: ctx.tarefaAtual,
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
      }
      // ==========================================================
      // FIM DO PASSO 11
      // ==========================================================


      
      // ==========================================================
      // PASSO 12: FASE DE ANÁLISE DO PROGRAMADOR
      // Usamos a IA para analisar o que o programador fez.
      // Se o programador implementou uma solução completa, vamos para a fase de finalização.
      // Caso contrário, podemos optar por dar feedback para o programador tentar corrigir ou melhorar.
      // TODO: esse controle de feedback está sendo feito dentro do passo.
      //       Podemos trazer essa lógica para cá.
      // ==========================================================
      {
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
          tarefaAtual: ctx.tarefaAtual,
          caminhoTaskDir: ctx.controle.taskDir || '',
          snapshotInicial: ctx.initialSnapshot,
          diretorioBase: this.deps.config.BASE_DIR,
          rawOutput: ctx.resultados?.programador?.rawOutput,
          toolCall: ctx.resultados?.programador?.toolCall,
          toolResult: ctx.resultados?.programador?.toolResult
        } as AnaliseProgramadorInput);
        ctx.resultados.resultAnaliseProgramador = {...analise};
        mensagemFinal = 'Trabalho do Programador rejeitado (nenhuma mudança confirmada).';
        novoStatus = ctx.config.STATUS.IN_PROGRESS;
        manterSessao = false;
        feedbackParaProgramador = '';

        // Inicializar controle de sessão se necessário
        if (!ctx.controle.tentativasCorrecao) {
          ctx.controle.tentativasCorrecao = 0;
          ctx.controle.maxTentativasCorrecao = 3; // Máximo de 3 tentativas de correção
        }
      }
      // ==========================================================
      // FIM DO PASSO 12
      // ==========================================================


      
      // ==========================================================
      // PASSO 13: TESTES
      // Fazemos o Build e testes da aplicação, se houver.
      // Caso contrário, vamos para a fase de finalização.
      // Em caso de erro de build/testes, enviamos feedback para o programador.
      // ==========================================================
      {
        if (ctx.resultados.resultAnaliseProgramador.workspaceValidado) {
          // Se não tem nenhum comando de build e teste, vamos para a fase de finalização

          if (!(ctx.tarefaAtual.domain === 'BACKEND' && ctx.project?.backendBuildCmd)
          && !(ctx.tarefaAtual.domain === 'FRONTEND' && ctx.project?.frontendBuildCmd)
          && !(ctx.tarefaAtual.domain === 'BACKEND' && ctx.project?.backendTestCommand)
          && !(ctx.tarefaAtual.domain === 'FRONTEND' && ctx.project?.frontendTestCommand)
          ) {
            await logger.info('⚠️ Nenhum comando de build/teste declarado. Vamos para a fase de finalização.');
          } else {
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
            
            // Verifica se tem os comandos de builds do front ou do back
            // TODO: BACKEND e FRONTEND devem ser um enum
            let build: ExecutarComandoOutput = { sucesso: false, stdout: '', stderr: '' };
            if (
              (ctx.tarefaAtual.domain === 'BACKEND' && ctx.project?.backendBuildCmd)
              || (ctx.tarefaAtual.domain === 'FRONTEND' && ctx.project?.frontendBuildCmd)
             ) {
              await logger.info('🔨 Iniciando rotina de Build/Lint...');
              build = await executor.execute({
                comando: ctx.tarefaAtual.domain === 'BACKEND' ? ctx.project?.backendBuildCmd : ctx.project?.frontendBuildCmd, // ou tsc --noEmit, dependendo do repositório configurado
                diretorioDeTrabalho: this.deps.config.BASE_DIR, 
              } as ExecutarComandoInput);
            }

            // Verifica se tem os comandos de testes do front ou do back
            let testes: ExecutarComandoOutput = { sucesso: false, stdout: '', stderr: '' };
            if (
              (ctx.tarefaAtual.domain === 'BACKEND' && ctx.project?.backendTestCommand)
              || (ctx.tarefaAtual.domain === 'FRONTEND' && ctx.project?.frontendTestCommand)
             ) {
              await logger.info('🧪 Iniciando rotina de Testes Automatizados...');
              testes = await executor.execute({
                comando: ctx.tarefaAtual.domain === 'BACKEND' ? ctx.project?.backendTestCommand : ctx.project?.frontendTestCommand,
                diretorioDeTrabalho: this.deps.config.BASE_DIR, 
              } as ExecutarComandoInput);
            }

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
              ctx.resultados.resultAnaliseProgramador.precisaCorrecao = true;
              ctx.resultados.resultAnaliseProgramador.tipoFalha = !build.sucesso ? 'BUILD_FALHOU' : 'TESTES_FALHARAM';
              ctx.resultados.resultAnaliseProgramador.mensagemCorrecao = feedbackParaProgramador;
              ctx.resultados.resultAnaliseProgramador.manterSessao = true;
              manterSessao = true;
            }
          }
        } else if (ctx.resultados.resultAnaliseProgramador.precisaCorrecao) {
          // Cenários a, b, d: Precisa de correção específica
          ctx.controle.tentativasCorrecao += 1;
          
          if (ctx.controle.tentativasCorrecao <= ctx.controle.maxTentativasCorrecao!) {
            // Ainda há tentativas disponíveis
            await logger.info(`🔄 Tentativa de correção ${ctx.controle.tentativasCorrecao}/${ctx.controle.maxTentativasCorrecao} para o programador.`);
            
            feedbackParaProgramador = `${ctx.resultados.resultAnaliseProgramador.mensagemCorrecao}\n\n${ctx.resultados.resultAnaliseProgramador.instrucoesEspecificas || ''}`;
            manterSessao = ctx.resultados.resultAnaliseProgramador.manterSessao || true;
            
            // Armazenar feedback para enviar ao programador
            ctx.controle.feedbackPendente = feedbackParaProgramador;
            ctx.controle.instrucoesCorrecao = ctx.resultados.resultAnaliseProgramador.instrucoesEspecificas;
            ctx.controle.sessaoAtiva = true;
            
            mensagemFinal = `🔄 Correção solicitada: ${ctx.resultados.resultAnaliseProgramador.tipoFalha}. Tentativa ${ctx.controle.tentativasCorrecao}/${ctx.controle.maxTentativasCorrecao}`;
            novoStatus = ctx.config.STATUS.IN_PROGRESS; // Mantém em progresso
          } else {
            // Esgotou tentativas de correção
            await logger.erro(`❌ Esgotadas ${ctx.controle.maxTentativasCorrecao} tentativas de correção. Encerrando tarefa.`);
            
            mensagemFinal = `❌ Tarefa rejeitada após ${ctx.controle.maxTentativasCorrecao} tentativas de correção.\nÚltimo erro: ${ctx.resultados.resultAnaliseProgramador.mensagemCorrecao}`;
            novoStatus = ctx.config.STATUS.FAILED; // Marca como falha
            ctx.controle.sessaoAtiva = false;
            ctx.controle.feedbackPendente = null;
            ctx.controle.instrucoesCorrecao = null;
          }
        }
      }
      // ==========================================================
      // FIM DO PASSO 13
      // ==========================================================

      // ==========================================================
      // PASSO 14: FINALIZAÇÃO DA TAREFA
      // A tarefa deve ser colocada no status correto,
      // isExecuting dela e dos parentes devem ser desmarcados
      // Se o pai não tiver outras tarefas pendentes, deve ser colocado no status finalizado
      // Isso vale para o avô, e toda a árvore de tarefas 
      // ==========================================================
      {
        await logger.debug('🔄 Finalizando tarefa...');

        if (!manterSessao) {
          // Encerrar sessão e finalizar tarefa
          const passoFinaliza: MacroFaseFinalizacao = new MacroFaseFinalizacao({
          logger,
          clienteApi: this.deps.clienteApi,
          apiUrl: this.deps.config.API_URL,
          userId: ctx.UserId,
        } as DependenciasFinalizacao);

          const finalizacao: FinalizacaoOutput = await passoFinaliza.execute({
            tarefaAtual: ctx.tarefaAtual,
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
          
          // TODO: Precisamos trazer a lógica do feedback para cá.
          if (feedbackParaProgramador) {
            await logger.info(`📤 Feedback para programador (simulado):\n${feedbackParaProgramador.substring(0, 300)}...`);
          }
        }
        
        // Se chegamos aqui, o ciclo dessa tarefa chegou ao fim!
        await logger.info(`🎉 Ciclo da Tarefa [${ctx.tarefaAtual.id}] completamente finalizado!`);
      }
      // ==========================================================
      // FIM DO PASSO 14
      // ==========================================================


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

