// monitor/Orquestrador.ts
// ─────────────────────────────────────────────────────
// ORQUESTRADOR IMPERATIVO (Imperative Orchestration)
//
// O coração do sistema. Abandonamos a Máquina de Estados
// (mapas de transição cegos) em favor de código puro.
// O fluxo (if, while, loops) é ditado por esta classe.
// ─────────────────────────────────────────────────────

import type { LoggerConsole } from './utils/LoggerConsole';
import type { TarefaCompleta, ConfiguracaoMonitor, ContextoExecucao, ProcessoFantasma } from './interfaces';
import type { Project } from '@prisma/client';
import PassoProgramador from './passos/atomicos/PassoProgramador';
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
import { FinalizacaoInput, FinalizacaoOutput, MacroFaseFinalizacao } from './passos/macro/FaseFinaliza';
import { DependenciasExecutarComando, ExecutarComandoInput, ExecutarComandoOutput, PassoExecutarComando } from './passos/atomicos/PassoExecutarComando';
import { FabricaPromptsIA } from './utils/fabricaPrompts';
import { DependenciasBase } from './passos';
import { DependenciasFinalizacao } from './passos/macro/FaseFinaliza';
import { DoneFileServiceDeps } from './services/DoneFileService';
import { EvidenceServiceDeps } from './services/EvidenceService';
import { DependenciasInspecaoWorkspace, InspecaoWorkspaceOutput, MacroFaseInspecaoWorkspace } from './passos/macro/FaseInspecaoWorkspace';
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
import { ProgramadorOutput } from './passos/atomicos/PassoProgramador';
import { AnaliseProgramadorOutput } from './passos/atomicos/PassoAnaliseProgramador';



export interface DependenciasGlobais {
  logger: LoggerConsole;
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
  private ctx : ContextoExecucao;
  private mensagemFinal: string = '';
  private logger: LoggerConsole;
  private novoStatus: string;
  private fluxoEncerradoPrematuramente: boolean = false;
  
  constructor(private readonly deps: DependenciasGlobais) {
    this.ctx = this.deps.criarContexto();
    this.logger = this.deps.logger;
    this.novoStatus = '';
  }

  /**
   * Avalia a necessidade de correção baseada na análise do programador
   * (TODO 4: Centralizar lógica de decisão de feedback)
   */
  /**
   * O fluxo mestre do Jarbas.
   * Lemos este método de cima para baixo. Dividido em 3 grandes blocos:
   * 1. Setup Linear (Lock, Buscas, IA Arquiteto)
   * 2. Loop de Correção (Programador <-> Análise)
   * 3. Fechamento (Testes Locais e Finalização)
   */

  public async setupLinear(): Promise<boolean> {
    // ────────────────────────────────────────────────────────
    // BLOCO 1: SETUP LINEAR (Executa estritamente 1 vez)
    // ────────────────────────────────────────────────────────
    await this.logger.info('🔄 Iniciando ciclo de tarefa...');

    // PASSO 1: PREPARAÇÃO DO AMBIENTE (Lock)
    {
      const lockStatus = await new PassoVerificaLock({
        logger: this.logger,
        lockService: this.deps.servicoLock,
        stateService: this.deps.servicoEstado,
      } as DependenciasVerificaLock).execute({ timeoutMs: this.ctx.config.TASK_TIMEOUT_MS } as VerificaLockInput);

      this.ctx.lockAtivo = lockStatus.lockAtivo;

      if (this.ctx.lockAtivo) return false; // Lock ativo: encerra silenciosamente

      if (lockStatus.processoFantasmaPid) {
        this.ctx.controle.processoFantasma = { pid: lockStatus.processoFantasmaPid } as ProcessoFantasma;
        await new PassoVerificaTimeout({ logger: this.logger } as DependenciasBase)
          .execute({ processoFantasmaPid: lockStatus.processoFantasmaPid } as VerificaTimeoutInput);
        return false; // Eject: Intervenção manual.
      }
    }

    // PASSO 2: CONFIGURAÇÃO DO USUÁRIO
    {
      const configUsuario: ConfiguraUsuarioOutput = await new PassoConfiguraUsuario({
        logger: this.logger,
        userService: this.deps.servicoUsuario,
      } as DependenciasConfiguraUsuario).execute({ nickname: this.ctx.config.MY_USER_NICKNAME } as ConfiguraUsuarioInput);

      this.ctx.UserId = configUsuario.userId;
    }

    // PASSO 3: BUSCA DE TAREFA
    {
      const busca = await new PassoBuscaTarefa({
        logger: this.logger,
        buscadorTarefa: this.deps.servicoBusca,
      } as DependenciasBuscaTarefa).execute({ nickname: this.ctx.config.MY_USER_NICKNAME } as BuscaTarefaInput);

      if (!busca.tarefa) {
        return false; // Eject silencioso: Fila vazia
      }

      this.ctx.tarefaAtual = busca.tarefa;
      this.ctx.project = busca.tarefa.project;
      this.ctx.configIA = { agentId: this.ctx.project.agent } as any;
      await this.logger.info(`🎯 Tarefa selecionada: ${this.ctx.tarefaAtual.title} [${this.ctx.tarefaAtual.id}]`);
    }

    // PASSO 4: INICIALIZAÇÃO DA TAREFA
    // Vamos trabalhar com JSONS (Pensar antes de implementar)
    {
      const inicializacao: InicializaTarefaOutput = await new PassoInicializaTarefa({
        logger: this.logger,
        stateService: this.deps.servicoEstado,
        lockService: this.deps.servicoLock,
        clienteApi: this.deps.clienteApi,
        fileSystem: this.deps.fileSystem,
        config: this.ctx.config,
        path: this.deps.pathUtil,
      } as DependenciasInicializaTarefa).execute({
        tarefa: this.ctx.tarefaAtual,
        apiUrl: this.ctx.config.API_URL,
        statusInProgress: this.ctx.config.STATUS.IN_PROGRESS
      } as InicializaTarefaInput);

      if (!inicializacao.sucesso) {
        this.ctx.erros.inicializacao = true;
        return false; // Falha grave de FileSystem
      }
      this.ctx.controle.taskDir = inicializacao.taskDir;
    }

    return true;
  }

  public async preAnalise(): Promise<boolean> {
    // PASSO 5: PREANALISE ESCOPO TAREFA COM IA
    {
      const preanalise: retornoTipoDaTarefaType = await new passoPreAnaliseEscopoTarefa(this.deps).execute(this.ctx);

      if (!preanalise) {
        return false; // Falha grave de FileSystem
      }
      if (preanalise.success === false) {
        return false;
      }
      if (preanalise.taskType === null) {
        return false;
      }

      this.ctx.outputPassos.preanalise = preanalise || null;
    }

    // PASSO 6: DETERMINAÇÃO DE ATOMICIDADE // RODA APENAS SE FOR DO TIPO DEVELOPMENT
    {
      if (this.ctx.outputPassos.preanalise?.taskType === 'development') {
        const verificacaoAtomicidade: VerificaAtomicidadeOutput = await new PassoVerificaAtomicidade(this.deps).execute(this.ctx);
        if (!verificacaoAtomicidade) {
          return false; // Falha grave de FileSystem
        }
        if (verificacaoAtomicidade.success === false) {
          return false;
        }
        if (verificacaoAtomicidade.isIdeal === null) {
          return false;
        }
        if (verificacaoAtomicidade.isIdeal) {
          this.ctx.tarefaAtual.isAtomic = true;
        } else {
          this.ctx.tarefaAtual.isAtomic = false;
        }
        this.ctx.outputPassos.verificacaoAtomicidade = verificacaoAtomicidade;
        await this.deps.servicoTarefas.updateTask(this.ctx.tarefaAtual.id, this.ctx.tarefaAtual);

      }
    }

    // PASSO 7: DECOMPOSIÇÃO // RODA APENAS SE FOR DO TIPO DEVELOPMENT
    {
      if (this.ctx.outputPassos.preanalise?.taskType === 'development' && this.ctx.tarefaAtual.isAtomic === false) {
        const decomposicao: DecompoeTarefaOutput = await new PassoDecompoeTarefa(this.deps).execute(this.ctx);

        if (!decomposicao.success) {
          await this.logger.erro('IA falhou ao decompor tarefa.');
          return false;
        }

        if (decomposicao.precisaDividir && decomposicao.subtarefas.length > 0) {
          await this.logger.info(`🎯 Tarefa decomposta em ${decomposicao.subtarefas.length} subtarefas. Persistindo no banco...`);
          for (const sub of decomposicao.subtarefas) {
            await this.deps.servicoTarefas.createTask({
              title: sub.title,
              description: sub.description,
              projectId: this.ctx.tarefaAtual.projectId,
              priorityId: this.ctx.tarefaAtual.priorityId,
              statusId: this.ctx.tarefaAtual.statusId,
              createdById: this.ctx.UserId,
              assignedToId: this.ctx.tarefaAtual.assignedToId,
              parentTaskId: this.ctx.tarefaAtual.id,
              domain: sub.domain,
              deadline: this.ctx.tarefaAtual.deadline,
            });
          }
          await this.logger.info("✅ Todas as subtarefas foram criadas. Encerrando execução da tarefa pai.");
          return false; // Tarefa mãe virou épico
        }
        
        this.ctx.tarefaAtual.isAtomic = true; 
        this.ctx.outputPassos.decomposicaoTarefa = decomposicao;
      }
    }

    // PASSO 8: DETERMINAÇÃO DE DOMÍNIO
    {
      if (this.ctx.outputPassos.preanalise?.taskType === 'development') {
        if (!this.ctx.tarefaAtual.domain) {
          const dominio = await new PassoVerificaDominio(this.deps as any).execute(this.ctx);

          if (!dominio.dominioValido) return false;
          if (dominio.dominio) this.ctx.tarefaAtual.domain = dominio.dominio;
          await this.deps.servicoTarefas.updateTask(this.ctx.tarefaAtual.id, { domain: dominio.dominio });
        }
      }
    }

    // CAPTURA DO SNAPSHOT INICIAL (Pré-Arquiteto)
    {
      if (this.ctx.outputPassos.preanalise?.taskType === 'development') {
        const snapshotService = new WorkspaceSnapshotService({ logger: this.logger, fileSystem: this.deps.fileSystem } as WorkspaceSnapshotServiceDeps);
        this.ctx.initialSnapshot = await snapshotService.takeSnapshot({ dir: this.deps.config.BASE_DIR } as SnapshotInput);
      }
    } 

    return true;
  }

  public async alterandoCodigoFonte(): Promise<boolean> {
    // PASSO 9: FASE DO ANALISTA DE SISTEMAS PARA FAZER A ANALISE PARA O PROGRAMADOR
    {
      if (this.ctx.outputPassos.preanalise?.taskType === 'development') {
        const passoArquiteto = new PassoArquiteto(this.deps as any);
        const resultadoArquiteto: ArquitetoOutput = await passoArquiteto.execute(this.ctx);
        
        if (!resultadoArquiteto || !resultadoArquiteto.success) {
          await this.logger.erro('IA falhou na fase do arquiteto).');
          return false;
        }

        this.ctx.resultados.arquiteto = resultadoArquiteto;

        if (resultadoArquiteto.isFullyImplemented) {
          this.fluxoEncerradoPrematuramente = true;
          this.mensagemFinal = '✅ Tarefa concluída integralmente pelo arquiteto (isFullyImplemented).';
          this.novoStatus = this.ctx.config.STATUS.COMPLETED;
          this.ctx.tarefaAtual.statusId = this.ctx.config.STATUS.COMPLETED;
          await this.deps.servicoTarefas.updateTask(this.ctx.tarefaAtual.id, { statusId: this.ctx.config.STATUS.COMPLETED });
        }
      }
    }
    
    let falhaIrreversivelNoProgramador = false;

    // PASSO 11 e 12: PROGRAMADOR E ANÁLISE DO WORKSPACE (com loop)
    {
      let loopProgramador = 0;
      const maxLoopProgramador = 3;
      let terminou = false;
      if (!this.fluxoEncerradoPrematuramente) {
        while (!terminou && loopProgramador++ < maxLoopProgramador) {
          await this.logger.info('🔄 Iniciando Fase do Programador (Sem loop)');
          const passoProgramador = new PassoProgramador(this.deps as DependenciasGlobais);
          const resultProgramador: ProgramadorOutput = await passoProgramador.execute(this.ctx);

          if (!resultProgramador || !resultProgramador.sucesso) {
            falhaIrreversivelNoProgramador = true;
            this.mensagemFinal = '❌ Programador falhou na execução.';
            this.novoStatus = this.ctx.config.STATUS.FAILED;
          } else {
            this.ctx.resultados.programador = resultProgramador as ProgramadorOutput;

            // INSPEÇÃO DO WORKSPACE
            const { MacroFaseInspecaoWorkspace } = await import('./passos/macro/FaseInspecaoWorkspace');
            const { EvidenceService } = await import('./services/EvidenceService');
            
            const faseInspecaoWorkspace = new MacroFaseInspecaoWorkspace(
            {
              logger : this.logger, snapshotService: this.deps.servicoSnapshot, 
              evidenceService: new EvidenceService({ logger: this.logger })
            } as any);

            const inspecao: InspecaoWorkspaceOutput = await faseInspecaoWorkspace.execute({
              tarefaAtual: this.ctx.tarefaAtual,
              snapshotInicial: this.ctx.initialSnapshot || new Map(),
              taskDir: this.ctx.controle.taskDir || '',
              rawOutput: resultProgramador.mensagem,
              toolCall: {},
              toolResult: {}
            } as any);

            this.ctx.resultados.inspecaoWorkspace = inspecao;

            const PassoAnaliseProgramador = (await import('./passos/atomicos/PassoAnaliseProgramador')).default;
            const passoAnalise = new PassoAnaliseProgramador(this.deps as any);
            const analise: AnaliseProgramadorOutput = await passoAnalise.execute(this.ctx);

            this.ctx.resultados.resultAnaliseProgramador = analise;

            if (analise && analise.workspaceValidado) {
              this.mensagemFinal = '✅ Trabalho validado. Prosseguindo para testes locais.';
              this.novoStatus = this.ctx.config.STATUS.IN_PROGRESS;
              terminou = true;
            } else {
              falhaIrreversivelNoProgramador = true;
              this.mensagemFinal = `❌ Tarefa rejeitada. Último erro: ${analise?.mensagemCorrecao}`;
            }
          }
        }

      }
    }

    // ────────────────────────────────────────────────────────
    // BLOCO 3: FECHAMENTO (Testes Locais e Finalização da Fila)
    // ────────────────────────────────────────────────────────

    // PASSO 13: TESTES (Só roda se não houve falha irreversível antes e se não encerrou no arquiteto)
    // TODO implementar retorno para o programador se der erro
    if (!falhaIrreversivelNoProgramador) {
      const executor = new PassoExecutarComando({ 
        logger: this.logger, 
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
      if ((this.ctx.tarefaAtual.domain === 'BACKEND' && this.ctx.project?.backendBuildCmd) || (this.ctx.tarefaAtual.domain === 'FRONTEND' && this.ctx.project?.frontendBuildCmd)) {
        await this.logger.info('🔨 Executando Build/Lint...');
        const build = await executor.execute({ comando: this.ctx.tarefaAtual.domain === 'BACKEND' ? this.ctx.project.backendBuildCmd : this.ctx.project.frontendBuildCmd, diretorioDeTrabalho: this.deps.config.BASE_DIR } as ExecutarComandoInput);
        buildSucesso = build.sucesso;
        if (!buildSucesso) logsErro += `Erro de Build:\n${build.stderr}\n`;
      }

      // Executa Testes
      if ((this.ctx.tarefaAtual.domain === 'BACKEND' && this.ctx.project?.backendTestCommand) || (this.ctx.tarefaAtual.domain === 'FRONTEND' && this.ctx.project?.frontendTestCommand)) {
        await this.logger.info('🧪 Executando Testes...');
        const testes = await executor.execute({ comando: this.ctx.tarefaAtual.domain === 'BACKEND' ? this.ctx.project.backendTestCommand : this.ctx.project.frontendTestCommand, diretorioDeTrabalho: this.deps.config.BASE_DIR } as ExecutarComandoInput);
        testesSucesso = testes.sucesso;
        if (!testesSucesso) logsErro += `Erro de Testes:\n${testes.stderr}\n`;
      }

      if (buildSucesso && testesSucesso) {
        this.mensagemFinal = `✅ Tudo verde! Código passou nos testes e builds.`;
        this.novoStatus = this.ctx.config.STATUS.COMPLETED;
      } else {
        // Falha nos testes causa falha na tarefa (não volta para o loop de IA local)
        this.mensagemFinal = `❌ Pipeline Local Falhou!\n${logsErro.substring(0, 500)}`;
        this.novoStatus = this.ctx.config.STATUS.FAILED;
      }
    }    

    return true;
  }

  public async finalizacao(): Promise<boolean> {
    // PASSO 14: FINALIZAÇÃO
    {
      await this.logger.debug('🔄 Encerrando a tarefa e limpando sessões...');

      // Fecha a sessão no OpenClaw, se existir
      if (this.ctx.controle.sessaoId && this.deps.sessionManager) {
        try {
          await this.deps.sessionManager.closeSession(this.ctx.controle.sessaoId);
          this.ctx.controle.sessaoId = null;
          this.ctx.controle.sessaoAtiva = false;
        } catch (error) {
          await this.logger.erro(`Erro ao fechar sessão no OpenClaw: ${error}`);
        }
      }
      
      const finalizacao = await new MacroFaseFinalizacao({
        logger: this.logger,
        clienteApi: this.deps.clienteApi,
        apiUrl: this.deps.config.API_URL,
        userId: this.ctx.UserId,
      } as DependenciasFinalizacao).execute({
        tarefaAtual: this.ctx.tarefaAtual,
        novoStatus: this.novoStatus,
        mensagemFechamento: this.mensagemFinal,
      } as FinalizacaoInput);

      if (!finalizacao.sucesso) {
        await this.logger.erro('O Orquestrador falhou gravemente ao persistir a finalização da tarefa na API.');
      } else {
        await this.logger.info(`🎉 Ciclo da Tarefa [${this.ctx.tarefaAtual.id}] encerrado. Status Final: ${this.novoStatus}`);
      }

      return true;
    }
  }

  public async executarCicloDaTarefa(): Promise<void> {
    try {
      if (!(await this.setupLinear())) return; 
      
      if (!(await this.preAnalise())) return;
      
      if (!(await this.alterandoCodigoFonte())) return;
      
      // A finalização só roda se tudo acima permitiu
      await this.finalizacao();
    } catch (erroGlobal: unknown) {
      const msg = erroGlobal instanceof Error ? erroGlobal.message : String(erroGlobal);
      await this.logger.erro(`💥 Erro fatal não tratado no Orquestrador: ${msg}`);
    } finally {
      // Liberação de infraestrutura garante que o processo pai destrave a esteira
      if (!this.ctx.lockAtivo && !this.ctx.controle.processoFantasma) {
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
      this.logger.info(`🎯 Tarefa FRONTEND: Lista reduzida de ${originalCount} para ${fileList.length} arquivos.`);
    } else if (domain === 'BACKEND' && project?.backendPath) {
      const originalCount = fileList.length;
      fileList = fileList.filter(file => 
        file.includes(project.backendPath) ||
        file.includes('prisma') ||
        file.includes('shared') ||
        !file.includes('/')
      );
      this.logger.info(`🎯 Tarefa BACKEND: Lista reduzida de ${originalCount} para ${fileList.length} arquivos.`);
    } else {
      this.logger.info(`🌍 Tarefa FULLSTACK ou domínio não especificado: Enviando todos os ${fileList.length} arquivos.`);
    }
    
    return fileList;
  }

}
