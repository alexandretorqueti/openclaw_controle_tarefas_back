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
import { PassoConfiguraUsuario } from './passos/atomicos/PassoConfiguraUsuario';
import { PassoBuscaTarefa } from './passos/atomicos/PassoBuscaTarefa';
import { PassoInicializaTarefa } from './passos/atomicos/PassoInicializaTarefa';
import { PassoSuperValidacao } from './passos/atomicos/PassoSuperValidacao';
import { LogicaDecomposicao } from './passos/atomicos/PassoDecompoeTarefa';
import { PassoVerificaDominio } from './passos/atomicos/PassoVerificaDominio';
import { MacroFaseArquiteto } from './passos/macro/FaseArquiteto';
import { MacroFaseProgramador } from './passos/macro/FaseProgramador';
import { MacroFaseAnaliseProgramador } from './passos/macro/FaseAnaliseProgramador';
import { MacroFaseFinalizacao } from './passos/macro/FaseFinaliza';
import { PassoExecutarComando } from './passos/atomicos/PassoExecutarComando';

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
  jsonValidator: any;
  gerenciadorFalha: any;
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
      }).execute(ctx); // Esse passo ainda atualiza o contexto diretamente (legado)

      if (ctx.lockAtivo) {
        return; // Lock recente e válido: encerra o ciclo.
      }

      if (ctx.controle.processoFantasma) {
        await logger.erro(
          `👻 Processo fantasma detectado (PID: ${ctx.controle.processoFantasma.pid}). Parando orquestrador.`
        );
        return; // Eject: Intervenção manual.
      }

      await new PassoConfiguraUsuario({
        logger,
        userService: this.deps.servicoUsuario,
      }).execute(ctx);

      // ==========================================================
      // FASE 2: CAPTURA E INICIALIZAÇÃO
      // ==========================================================

      await new PassoBuscaTarefa({
        logger,
        buscadorTarefa: this.deps.servicoBusca,
      }).execute(ctx);

      const tarefa = ctx.tarefaAtual;
      if (!tarefa) {
        return; // Fila vazia: O trabalhador aguarda.
      }

      await new PassoInicializaTarefa({
        logger,
        lockService: this.deps.servicoLock,
        stateService: this.deps.servicoEstado,
        fileSystem: this.deps.fileSystem,
        clienteApi: this.deps.clienteApi,
        path: this.deps.pathUtil,
      }).execute(ctx);

      if (ctx.erros.inicializacao) {
        return; // Falha grave no FileSystem ou Lock. Aborta.
      }

      // ==========================================================
      // FASE 3: VALIDAÇÃO DE NEGÓCIO E ROTEAMENTO
      // ==========================================================

      await new PassoSuperValidacao({ logger }).execute(ctx);

      if (ctx.erros.fatalIA) {
        return; // Tarefa malformada
      }

      // DECOMPOSIÇÃO: Se for uma "Epic" (não atômica)
      if (tarefa.isAtomic === false) {
        const passoDecomposicao = new LogicaDecomposicao({
          logger,
          analista: this.deps.servicoAnalista,
        });

        // Executamos o passo puro
        const resultDecomposicao = await passoDecomposicao.execute({
          tarefaAtual: tarefa,
          userId: ctx.UserId,
        });

        // Mutações explícitas
        if (!resultDecomposicao.sucesso || resultDecomposicao.quantidadeSubtarefas === 0) {
          ctx.erros.decomposicao = true;
          await logger.erro('IA falhou ao decompor tarefa. Abortando esteira.');
          return; // Deu erro na IA, para o fluxo.
        }

        // Sucesso total na decomposição: A mãe não precisa ser executada (subtasks criadas)
        return; 
      }

      // VERIFICAÇÃO DE DOMÍNIO
      await new PassoVerificaDominio({
        logger,
        gerenciadorFalha: this.deps.gerenciadorFalha,
      }).execute(ctx);

      if (ctx.erros.dominio) {
        return; // Eject: Tarefa atômica sem domínio.
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

      const resultArquiteto = await passoArquiteto.execute({
        tarefaAtual: tarefa,
        planoAnalise: ctx.analysisPlan,
        promptInicial: `Gere o plano de arquitetura para a tarefa: ${tarefa.title}\n\n${tarefa.description}`,
        caminhoPlanoParaSalvar,
      });

      if (!resultArquiteto.sucesso) {
        await logger.erro('O Arquiteto falhou criticamente.');
        return; // Eject
      }

      await logger.info('🛠️ Plano validado e salvo. Pronto para o Programador!');

      // PASSO DO PROGRAMADOR (Macro Passo)
      const passoProgramador = new MacroFaseProgramador({
        logger,
        openClaw: this.deps.servicoOpenClaw,
        jsonValidator: this.deps.jsonValidator,
      });

      const resultProgramador = await passoProgramador.execute({
        tarefaAtual: tarefa,
        planoArquiteto: resultArquiteto.planDetails,
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
      });

      const analise = await analisadorDisco.execute({
        tarefaAtual: tarefa,
        caminhoTaskDir: ctx.controle.taskDir || '',
      });

      let mensagemFinal = 'Trabalho do Programador rejeitado (nenhuma mudança confirmada).';
      let novoStatus = ctx.config.STATUS.IN_PROGRESS;

      if (analise.workspaceValidado) {
        // RODA OS BUILDS E TESTES
        const executor = new PassoExecutarComando({ logger });
        
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
