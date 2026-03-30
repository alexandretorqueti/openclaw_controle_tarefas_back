// monitor/monitoramento.ts
// ═══════════════════════════════════════════════════════════════
// ENTRY POINT — Motor de Monitoramento e Execução de Tarefas por IA
//
// Este é o ponto de partida do sistema. Ele:
//   1. Inicializa a infraestrutura (logger, config, container)
//   2. Instancia os passos com suas dependências injetadas
//   3. Registra tudo no Motor de Passos
//   4. Roda o daemon loop eternamente
//
// Arquitetura:
//   - Orquestrador Imperativo (Imperative Orchestration)
//   - Passos com contrato estrito (Template Method + DI)
//   - Roteamento por mapa declarativo de transições
//
// Para rodar:
//   npx tsx monitor/monitoramento.ts
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────
// 1. INFRAESTRUTURA
// ─────────────────────────────────────────────────────

import '../src/bootstrap';
import container = require('../src/container');
import config from '../src/aux/config';

import type {
  ConfiguracaoMonitor,
  ServicoLock,
  ServicoEstado,
  ServicoUsuario,
  ServicoAnaliseTarefa,
  FabricaPrompts,
  Passo,
} from './interfaces';
import type { Logger } from './interfaces/logger';

// ─────────────────────────────────────────────────────
// 2. UTILS DO MOTOR
// ─────────────────────────────────────────────────────

import { LoggerConsole } from './utils/LoggerConsole';
import { MotorDePassos } from './utils/MotorDePassos';
import { criarContextoLimpo } from './utils/fabricaContexto';
import { mapaDeTransicoes } from './utils/mapaDeTransicoes';
import { salvarContextoParaDebug } from './utils/debugContexto';

import { StepName } from './interfaces';

// ─────────────────────────────────────────────────────
// 3. PASSOS ATÔMICOS
// ─────────────────────────────────────────────────────

import { PassoVerificaLock } from './passos/atomicos/PassoVerificaLock';
import { PassoVerificaTimeout } from './passos/atomicos/PassoVerificaTimeout';
import { PassoConfiguraUsuario } from './passos/atomicos/PassoConfiguraUsuario';
import { PassoBuscaTarefa } from './passos/atomicos/PassoBuscaTarefa';
import { PassoInicializaTarefa } from './passos/atomicos/PassoInicializaTarefa';
import { PassoSuperValidacao } from './passos/atomicos/PassoSuperValidacao';
import { PassoDecompoeTarefaAdapter } from './passos/adapters/DecomposicaoAdapter';
import { PassoVerificaDominio } from './passos/atomicos/PassoVerificaDominio';

// ─────────────────────────────────────────────────────
// 4. ADAPTERS — Conecta ao sistema legado
// ─────────────────────────────────────────────────────

import type { BuscadorTarefa } from './passos/atomicos/PassoBuscaTarefa';
import type { ClienteApiStatus } from './passos/atomicos/PassoInicializaTarefa';
import type { ServicoAnalistaTarefa, DecomposicaoOutput } from './passos/atomicos/PassoDecompoeTarefa';
import type { GerenciadorFalhaTarefa, ConfiguracaoFalha } from './passos/atomicos/PassoVerificaDominio';
import type { TarefaCompleta } from './interfaces';
import axios from 'axios';

/**
 * Adapter que conecta o BuscadorTarefa ao endpoint legado da API.
 */
class BuscadorTarefaViaApi implements BuscadorTarefa {
  private readonly apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async buscarProxima(nickname: string): Promise<TarefaCompleta | null> {
    const { createLegacyGetNextTask } = require('../src/steps/adapters/legacyGetNextTask');
    const getNextTask = createLegacyGetNextTask(this.apiUrl);
    return getNextTask(nickname);
  }
}

/**
 * Adapter que conecta o ClienteApiStatus ao endpoint legado.
 */
class ClienteApiStatusViaAxios implements ClienteApiStatus {
  async buscarStatusPorNome(
    apiUrl: string,
    nome: string
  ): Promise<{ id: number } | null> {
    const response = await axios.get(`${apiUrl}/api/statuses`);
    const statuses: Array<{ id: number; name: string }> = response.data?.statuses ?? [];
    const encontrado = statuses.find(
      (s) => s.name === nome || s.name === 'Em Andamento'
    );
    return encontrado ?? null;
  }

  async atualizarStatusTarefa(
    apiUrl: string,
    taskId: number | string,
    statusId: number
  ): Promise<void> {
    await axios.put(`${apiUrl}/api/tasks/${taskId}`, { statusId });
  }
}

/**
 * Adapter para chamar o serviço legado de decomposição (CallAnalyst)
 */
class ServicoAnalistaLegacy implements ServicoAnalistaTarefa {
  async decompor(tarefa: TarefaCompleta, userId: string | null): Promise<DecomposicaoOutput> {
    const { createLegacyCallAnalyst } = require('../src/steps/adapters/legacyCallAnalyst');
    const callAnalyst = createLegacyCallAnalyst(userId);
    const resultado = await callAnalyst(tarefa);

    return {
      sucesso: resultado?.success ?? false,
      quantidadeSubtarefas: resultado?.subtasksCreated ?? 0,
    };
  }
}

/**
 * Adapter para acionar a rotina legada de handleTaskFailure
 */
class GerenciadorFalhaLegacy implements GerenciadorFalhaTarefa {
  async registrarFalha(
    tarefa: TarefaCompleta,
    erro: Error,
    userId: string | null,
    configFalha: ConfiguracaoFalha
  ): Promise<void> {
    const { handleTaskFailure } = require('../src/steps/adapters/legacyTaskFailure');
    await handleTaskFailure(tarefa, erro, userId, {
      API_URL: configFalha.apiUrl,
      TASKS_DIR: configFalha.tasksDir,
      ERROR_DIR: configFalha.errorDir,
    });
  }
}

// ═══════════════════════════════════════════════════════
// 5. CLASSE PRINCIPAL — Monitoramento
// ═══════════════════════════════════════════════════════

const INTERVALO_VERIFICACAO_MS = 60_000; // 1 minuto
const INTERVALO_APOS_ERRO_MS = 30_000;  // 30 segundos
const PASSO_INICIAL = StepName.VERIFICA_LOCK;

export class Monitoramento {
  private readonly motor: MotorDePassos;
  private readonly logger: Logger;
  private readonly configuracao: ConfiguracaoMonitor;
  private readonly lockService: ServicoLock;
  private jaEnviouMensagemAguardando: boolean = false;

  constructor() {
    // ─── Logger ───
    this.configuracao = config as ConfiguracaoMonitor;
    this.logger = new LoggerConsole({
      caminhoArquivo: this.configuracao.LOG_FILE,
      maxLinhas: this.configuracao.MAX_LOG_LINES,
    });

    // ─── Serviços do container legado ───
    this.lockService = container.resolve('lockService') as ServicoLock;
    const stateService = container.resolve('monitorStateService') as ServicoEstado;
    const userService = container.resolve('userService') as ServicoUsuario;
    const taskAnalysisService = container.resolve('taskAnalysisService') as ServicoAnaliseTarefa;
    const promptFactory = container.resolve('promptFactory') as FabricaPrompts;

    // ─── Motor de Passos ───
    this.motor = new MotorDePassos({
      logger: this.logger,
      mapaDeTransicoes,
    });

    // ─── Instanciação dos passos com DI ───
    const passos: Passo[] = [
      new PassoVerificaLock({
        logger: this.logger,
        lockService: this.lockService,
        stateService,
      }),
      new PassoVerificaTimeout({
        logger: this.logger,
      }),
      new PassoConfiguraUsuario({
        logger: this.logger,
        userService,
      }),
      new PassoBuscaTarefa({
        logger: this.logger,
        buscadorTarefa: new BuscadorTarefaViaApi(this.configuracao.API_URL),
      }),
      new PassoInicializaTarefa({
        logger: this.logger,
        lockService: this.lockService,
        stateService,
        fileSystem: require('fs').promises,
        clienteApi: new ClienteApiStatusViaAxios(),
        path: require('path'),
      }),
      new PassoSuperValidacao({
        logger: this.logger,
      }),
      new PassoDecompoeTarefaAdapter({
        logger: this.logger,
        analista: new ServicoAnalistaLegacy(),
      }),
      new PassoVerificaDominio({
        logger: this.logger,
        gerenciadorFalha: new GerenciadorFalhaLegacy(),
      }),
    ];

    this.motor.registrarTodos(passos);
  }

  // ═══════════════════════════════════════════════════════
  // DAEMON LOOP
  // ═══════════════════════════════════════════════════════

  async iniciar(): Promise<void> {
    await this.logger.info('🚀 Monitor de tarefas iniciado (Workflow Engine v2)');

    while (true) {
      try {
        await this.executarCiclo();

        if (!this.jaEnviouMensagemAguardando) {
          await this.logger.info('⏳ Aguardando a próxima verificação...');
          this.jaEnviouMensagemAguardando = true;
        }

        await this.aguardar(INTERVALO_VERIFICACAO_MS);
      } catch (erroLoop: unknown) {
        const mensagem = erroLoop instanceof Error ? erroLoop.message : String(erroLoop);
        await this.logger.erro(`💥 Erro no loop principal: ${mensagem}`);
        await this.aguardar(INTERVALO_APOS_ERRO_MS);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // CICLO DE EXECUÇÃO
  // ═══════════════════════════════════════════════════════

  private async executarCiclo(): Promise<void> {
    const contexto = criarContextoLimpo({
      config: this.configuracao,
      services: {
        lockService: this.lockService,
        stateService: container.resolve('monitorStateService') as ServicoEstado,
        fileService: container.resolve('taskFileService') as unknown as import('./interfaces').ServicoArquivosTarefa,
        userService: container.resolve('userService') as ServicoUsuario,
        taskAnalysisService: container.resolve('taskAnalysisService') as ServicoAnaliseTarefa,
      },
      utils: {
        promptFactory: container.resolve('promptFactory') as FabricaPrompts,
      },
    });

    try {
      const passosExecutados = await this.motor.executar(PASSO_INICIAL, contexto);

      await this.logger.info(
        `Ciclo finalizado. Passos: ${passosExecutados.join(' → ')}`
      );

      // Se processou uma tarefa, reseta a flag de "aguardando"
      if (contexto.tarefaAtual) {
        this.jaEnviouMensagemAguardando = false;
      }
    } catch (erroCiclo: unknown) {
      const mensagem = erroCiclo instanceof Error ? erroCiclo.message : String(erroCiclo);
      await this.logger.erro(`💥 Erro fatal no ciclo: ${mensagem}`);
    } finally {
      // Liberação de lock se o ciclo terminou sem processos pendentes
      if (!contexto.lockAtivo && !contexto.controle.processoFantasma) {
        await this.lockService.releaseLock();
      }
    }
  }

  private async aguardar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════
// EXECUÇÃO DIRETA
// ═══════════════════════════════════════════════════════

if (require.main === module) {
  const monitor = new Monitoramento();
  monitor.iniciar().catch((err) => {
    console.error('💀 Erro fatal ao iniciar monitoramento:', err);
    process.exit(1);
  });
}
