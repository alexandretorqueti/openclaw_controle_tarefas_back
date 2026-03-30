// monitor/monitoramento.ts
// ═══════════════════════════════════════════════════════════════
// ENTRY POINT — Motor de Monitoramento e Execução de Tarefas por IA
//
// Este é o ponto de partida do sistema. Ele:
//   1. Inicializa a infraestrutura (logger, config, container)
//   2. Instancia o Orquestrador Mestre
//   3. Roda o daemon loop eternamente
//
// Arquitetura:
//   - Orquestrador Imperativo (Imperative Orchestration)
//   - Passos com contrato estrito (Template Method + DI)
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
} from './interfaces';
import type { Logger } from './interfaces/logger';

// ─────────────────────────────────────────────────────
// 2. UTILS E ORQUESTRADOR
// ─────────────────────────────────────────────────────

import { LoggerConsole } from './utils/LoggerConsole';
import { criarContextoLimpo } from './utils/fabricaContexto';
import { salvarContextoParaDebug } from './utils/debugContexto';
import { OrquestradorTarefas } from './Orquestrador';

// ─────────────────────────────────────────────────────
// 3. ADAPTERS — Conecta ao sistema legado
// ─────────────────────────────────────────────────────

import type { BuscadorTarefa } from './passos/atomicos/PassoBuscaTarefa';
import type { ClienteApiStatus } from './passos/atomicos/PassoInicializaTarefa';
import type { ServicoAnalistaTarefa, DecomposicaoOutput } from './passos/atomicos/PassoDecompoeTarefa';
import type { GerenciadorFalhaTarefa, ConfiguracaoFalha } from './passos/atomicos/PassoVerificaDominio';
import type { ChamarIAInput } from './passos/atomicos/PassoChamarIA';
import type { TarefaCompleta } from './interfaces';
import fs from 'fs';
import axios from 'axios';

/**
 * Adapter para usar o módulo "fs" real no FileSystem
 */
class ServicoDiscoLegacy {
  async escrever(caminho: string, conteudo: string, criar: boolean): Promise<void> {
    if (criar) {
      const { dirname } = require('path');
      await fs.promises.mkdir(dirname(caminho), { recursive: true });
    }
    await fs.promises.writeFile(caminho, conteudo, 'utf-8');
  }
  async ler(caminho: string): Promise<string> {
    return fs.promises.readFile(caminho, 'utf-8');
  }
  async apagar(caminho: string): Promise<void> {
    await fs.promises.unlink(caminho);
  }
}

/**
 * Adapter para chamar a API real do OpenClaw usando container legado
 */
class ServicoOpenClawLegacy {
  async executarTurno(input: ChamarIAInput): Promise<{ sucesso: boolean; output: string }> {
    const OpenClawService = require('../src/services/openclawService');
    const resultado = await OpenClawService.executeAgent({
      prompt: input.prompt,
      agent: input.agente,
      // Passar context, workspace e arquivos caso implementado
    });
    return {
      sucesso: resultado?.success ?? false,
      output: resultado?.rawOutput ?? '',
    };
  }
}

/**
 * Utilitário: JSON parse genérico ou baseado em schema.
 */
class JsonValidator {
  parsear(texto: string): any {
    return JSON.parse(texto);
  }
}

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

export class Monitoramento {
  private readonly orquestrador: OrquestradorTarefas;
  private readonly logger: Logger;
  private jaEnviouMensagemAguardando: boolean = false;

  constructor() {
    // ─── Logger ───
    const configuracao = config as ConfiguracaoMonitor;
    this.logger = new LoggerConsole({
      caminhoArquivo: configuracao.LOG_FILE,
      maxLinhas: configuracao.MAX_LOG_LINES,
    });

    // ─── Serviços do container legado ───
    const lockService = container.resolve('lockService') as ServicoLock;
    const stateService = container.resolve('monitorStateService') as ServicoEstado;
    const fileService = container.resolve('taskFileService') as any;
    const userService = container.resolve('userService') as ServicoUsuario;
    const taskAnalysisService = container.resolve('taskAnalysisService') as ServicoAnaliseTarefa;
    const promptFactory = container.resolve('promptFactory') as FabricaPrompts;

    // ─── Orquestrador Imperativo ───
    this.orquestrador = new OrquestradorTarefas({
      logger: this.logger,
      config: configuracao,
      servicoLock: lockService,
      servicoEstado: stateService,
      servicoArquivos: fileService,
      servicoUsuario: userService,
      servicoAnaliseTarefa: taskAnalysisService,
      clienteApi: new ClienteApiStatusViaAxios(),
      fileSystem: require('fs').promises,
      pathUtil: require('path'),
      servicoBusca: new BuscadorTarefaViaApi(configuracao.API_URL),
      servicoAnalista: new ServicoAnalistaLegacy(),
      servicoOpenClaw: new ServicoOpenClawLegacy(),
      servicoDisco: new ServicoDiscoLegacy(),
      jsonValidator: new JsonValidator(),
      gerenciadorFalha: new GerenciadorFalhaLegacy(),
      criarContexto: () => criarContextoLimpo({
        config: configuracao,
        services: {
          lockService,
          stateService,
          fileService,
          userService,
          taskAnalysisService,
        },
        utils: { promptFactory },
      }),
    });
  }

  // ═══════════════════════════════════════════════════════
  // DAEMON LOOP
  // ═══════════════════════════════════════════════════════

  async iniciar(): Promise<void> {
    await this.logger.info('🚀 Monitor de tarefas iniciado (Orquestrador Imperativo v3)');

    while (true) {
      try {
        await this.orquestrador.executarCicloDaTarefa();

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
