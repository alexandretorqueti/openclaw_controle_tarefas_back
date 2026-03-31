// monitor/Orquestrador.ts
// ─────────────────────────────────────────────────────
// ORQUESTRADOR IMPERATIVO (Imperative Orchestration)
//
// O coração do sistema. Abandonamos a Máquina de Estados
// (mapas de transição cegos) em favor de código puro.
// O fluxo (if, while, loops) é ditado por esta classe.
// ─────────────────────────────────────────────────────

import type { Logger } from './interfaces/logger';
import type { TarefaCompleta, ConfiguracaoMonitor, ContextoExecucao } from './interfaces';

// Importando a Lógica Pura (Passos Atômicos)
import { PassoVerificaLock } from './passos/atomicos/PassoVerificaLock';
import { PassoVerificaTimeout } from './passos/atomicos/PassoVerificaTimeout';
import { PassoConfiguraUsuario } from './passos/atomicos/PassoConfiguraUsuario';
import { PassoBuscaTarefa } from './passos/atomicos/PassoBuscaTarefa';
import { PassoInicializaTarefa } from './passos/atomicos/PassoInicializaTarefa';
import { PassoSuperValidacao } from './passos/atomicos/PassoSuperValidacao';
import { LogicaDecomposicao } from './passos/atomicos/PassoDecompoeTarefa';
import { PassoVerificaDominio } from './passos/atomicos/PassoVerificaDominio';
import { PassoVerificaAtomicidade } from './passos/atomicos/PassoVerificaAtomicidade';
import { MacroFaseArquiteto } from './passos/macro/FaseArquiteto';
import { MacroFaseProgramador } from './passos/macro/FaseProgramador';
import { MacroFaseAnaliseProgramador } from './passos/macro/FaseAnaliseProgramador';
import { MacroFaseFinalizacao } from './passos/macro/FaseFinaliza';
import { PassoExecutarComando } from './passos/atomicos/PassoExecutarComando';
import { FabricaPromptsIA } from './utils/FabricaPrompts';
import { WorkspaceSnapshotService } from './services/WorkspaceSnapshotService';

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
  servicoSnapshot: any;
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

      const lockStatus = await new PassoVerificaLock({
        logger,
        lockService: this.deps.servicoLock,
        stateService: this.deps.servicoEstado,
      }).execute({ timeoutMs: ctx.config.TASK_TIMEOUT_MS });

      // Atualizamos o contexto centralizadamente
      ctx.lockAtivo = lockStatus.lockAtivo;

      if (ctx.lockAtivo) {
        return; // Lock recente e válido: encerra o ciclo.
      }

      if (lockStatus.processoFantasmaPid) {
        ctx.controle.processoFantasma = { pid: lockStatus.processoFantasmaPid };
        await new PassoVerificaTimeout({ logger }).execute({ processoFantasmaPid: lockStatus.processoFantasmaPid });
        return; // Eject: Intervenção manual.
      }

      const configUsuario = await new PassoConfiguraUsuario({
        logger,
        userService: this.deps.servicoUsuario,
      }).execute({ nickname: ctx.config.MY_USER_NICKNAME });

      ctx.UserId = configUsuario.userId;

      // ==========================================================
      // FASE 2: CAPTURA E INICIALIZAÇÃO
      // ==========================================================

      const captura = await new PassoBuscaTarefa({
        logger,
        buscadorTarefa: this.deps.servicoBusca,
      }).execute({ nickname: ctx.config.MY_USER_NICKNAME });

      const tarefa = captura.tarefa;
      ctx.tarefaAtual = tarefa;

      if (!tarefa) {
        return; // Fila vazia: O trabalhador aguarda.
      }

      const inicializacao = await new PassoInicializaTarefa({
        logger,
        lockService: this.deps.servicoLock,
        stateService: this.deps.servicoEstado,
        fileSystem: this.deps.fileSystem,
        clienteApi: this.deps.clienteApi,
        path: this.deps.pathUtil,
      }).execute({
        tarefa,
        tasksDir: ctx.config.TASKS_DIR,
        apiUrl: ctx.config.API_URL,
        statusInProgress: ctx.config.STATUS.IN_PROGRESS,
      });

      if (!inicializacao.sucesso) {
        ctx.erros.inicializacao = true;
        return; // Falha grave no FileSystem ou Lock. Aborta.
      }
      
      ctx.controle.taskDir = inicializacao.taskDir;

      // ==========================================================
      // FASE 3: VALIDAÇÃO DE NEGÓCIO E ROTEAMENTO
      // ==========================================================

      const superValidacao = await new PassoSuperValidacao({ logger, taskAnalysisService: this.deps.servicoAnaliseTarefa }).execute({ tarefa });

      if (!superValidacao.valido) {
        ctx.erros.fatalIA = true;
        return; // Tarefa malformada
      }
      
      ctx.analysisPlan = superValidacao.planoDeAnalise || null;

      // VERIFICAÇÃO DE ATOMICIDADE (se não definida no banco)
      let isAtomic = tarefa.isAtomic;
      if (isAtomic === undefined || isAtomic === null) {
        const passoAtomicidade = new PassoVerificaAtomicidade({
          logger,
          servicoLlmAtomicidade: this.deps.servicoLlmAtomicidade,
          fabricaPrompts: FabricaPromptsIA,
        });

        const resultadoAtomicidade = await passoAtomicidade.execute({ tarefa });
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
        const passoDecomposicao = new LogicaDecomposicao({
          logger,
          analista: this.deps.servicoAnalista,
        });

        const promptDecomposicao = FabricaPromptsIA.gerarPromptDecomposicao(tarefa);

        // Executamos o passo puro
        const resultDecomposicao = await passoDecomposicao.execute({
          tarefaAtual: tarefa,
          userId: ctx.UserId,
          prompt: promptDecomposicao,
        });

        if (resultDecomposicao.sucesso && resultDecomposicao.quantidadeSubtarefas === 0) {
          ctx.erros.decomposicao = false;
          ctx.tarefaAtual.isAtomic = true; // Marca a tarefa como atômica para evitar futuras tentativas de decomposição
          await logger.erro('A IA decidiu não decompor a tarefa. A tarefa é atômica, segue fluxo normal.');
          return; // Tudo certo!
        }

        // Mutações explícitas
        if (!resultDecomposicao.sucesso) {
          ctx.erros.decomposicao = true;
          await logger.erro('IA falhou ao decompor tarefa. Abortando esteira.');
          return; // Deu erro na IA, para o fluxo.
        }

        // Sucesso total na decomposição: A mãe não precisa ser executada (subtasks criadas)
        return; 
      }

      // VERIFICAÇÃO DE DOMÍNIO
      const dominio = await new PassoVerificaDominio({
        logger,
        gerenciadorFalha: this.deps.gerenciadorFalha,
        servicoLlmAuxiliar: this.deps.servicoLlmAuxiliar,
        fabricaPrompts: FabricaPromptsIA,
      }).execute({
        tarefa,
        userId: ctx.UserId,
        configFalha: {
          apiUrl: ctx.config.API_URL,
          tasksDir: ctx.config.TASKS_DIR,
          errorDir: ctx.config.ERROR_DIR,
        },
      });

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

      const caminhoPlanoParaSalvar = this.deps.pathUtil.join(ctx.controle.taskDir || '', 'architect_plan.json');

      // PASSO DO ARQUITETO (Macro Passo)
      const passoArquiteto = new MacroFaseArquiteto({
        logger,
        openClaw: this.deps.servicoOpenClaw,
        disco: this.deps.servicoDisco,
        jsonValidator: this.deps.jsonValidator,
      });

      const promptArquiteto = FabricaPromptsIA.gerarPromptArquiteto(
        tarefa,
        {
          pastaBase: this.deps.config.BASE_DIR,
          // Mapeie dados de projetos caso existam
        },
        caminhoPlanoParaSalvar
      );

      const resultArquiteto = await passoArquiteto.execute({
        tarefaAtual: tarefa,
        planoAnalise: ctx.analysisPlan,
        promptInicial: promptArquiteto,
        caminhoPlanoParaSalvar,
      });

      if (!resultArquiteto.sucesso) {
        await logger.erro('O Arquiteto falhou criticamente.');
        return; // Eject
      }

      await logger.info('🛠️ Plano validado e salvo. Pronto para o Programador!');

      // CAPTURAR SNAPSHOT INICIAL (antes do programador)
      await logger.info('📸 Capturando snapshot inicial do workspace...');
      const snapshotService = new WorkspaceSnapshotService({
        logger,
        fileSystem: this.deps.fileSystem,
      });
      const snapshotInicial = await snapshotService.takeSnapshot(this.deps.config.BASE_DIR);
      ctx.initialSnapshot = snapshotInicial;
      await logger.info(`✅ Snapshot inicial capturado: ${snapshotInicial.size} arquivos`);

      // PASSO DO PROGRAMADOR (Macro Passo)
      const passoProgramador = new MacroFaseProgramador({
        logger,
        openClaw: this.deps.servicoOpenClaw,
        jsonValidator: this.deps.jsonValidator,
      });

      const promptProgramador = FabricaPromptsIA.gerarPromptProgramador(
        tarefa,
        resultArquiteto.planDetails || 'Sem plano.',
        ctx.controle.taskDir || ''
      );

      const resultProgramador = await passoProgramador.execute({
        tarefaAtual: tarefa,
        planoArquiteto: promptProgramador,
      });

      if (!resultProgramador.sucesso) {
        await logger.erro('O Programador falhou ou estourou o limite de turnos.');
        return; // Eject
      }

      // ==========================================================
      // FASE 5: INSPEÇÃO, BUILDS E TESTES
      // ==========================================================

      await logger.info(`🔎 Programador declarou que terminou. Inspecionando o trabalho...`);

      const analisadorDisco = new MacroFaseAnaliseProgramador({
        logger,
        arquivos: {
          existe: async (caminho: string) => {
            try {
              await this.deps.fileSystem.access(caminho);
              return true;
            } catch {
              return false;
            }
          },
        },
        snapshotService,
      });

      const analise = await analisadorDisco.execute({
        tarefaAtual: tarefa,
        caminhoTaskDir: ctx.controle.taskDir || '',
        snapshotInicial,
        diretorioBase: this.deps.config.BASE_DIR,
      });

      let mensagemFinal = 'Trabalho do Programador rejeitado (nenhuma mudança confirmada).';
      let novoStatus = ctx.config.STATUS.IN_PROGRESS;

      if (analise.workspaceValidado) {
        // RODA OS BUILDS E TESTES
        const executor = new PassoExecutarComando({ 
          logger,
          terminal: {
            executar: async (comando, opcoes) => {
              const { exec } = require('child_process');
              const { promisify } = require('util');
              const execAsync = promisify(exec);
              return execAsync(comando, opcoes);
            }
          }
        });
        
        await logger.info('🔨 Iniciando rotina de Build/Lint...');
        const build = await executor.execute({
          comando: 'npm run build', // ou tsc --noEmit, dependendo do repositório configurado
          diretorioDeTrabalho: this.deps.config.BASE_DIR, 
        });

        await logger.info('🧪 Iniciando rotina de Testes Automatizados...');
        const testes = await executor.execute({
          comando: 'npm run test',
          diretorioDeTrabalho: this.deps.config.BASE_DIR, 
        });

        if (build.sucesso && testes.sucesso) {
          mensagemFinal = `✅ Tudo verde! Código passou em todos os testes e builds.\n\nLogs:\n${testes.stdout.substring(0, 500)}...`;
          novoStatus = ctx.config.STATUS.COMPLETED;
        } else {
          mensagemFinal = `❌ O código falhou na esteira de CI/CD local!\nBuild: ${build.sucesso ? 'Ok' : 'Falhou'}\nTestes: ${testes.sucesso ? 'Ok' : 'Falhou'}\n\nLogs:\n${(testes.stderr || build.stderr).substring(0, 1000)}`;
          // Podemos enviar isso de volta para o Programador num loop de auto-correção maior aqui!
        }
      }

      // ==========================================================
      // FASE 6: FINALIZAÇÃO
      // ==========================================================

      const passoFinaliza = new MacroFaseFinalizacao({
        logger,
        clienteApi: this.deps.clienteApi,
        apiUrl: this.deps.config.API_URL,
        userId: ctx.UserId,
      });

      await passoFinaliza.execute({
        tarefaAtual: tarefa,
        novoStatus,
        mensagemFechamento: mensagemFinal,
      });

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
}
