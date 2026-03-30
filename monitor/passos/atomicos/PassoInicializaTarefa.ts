// monitor/passos/atomicos/PassoInicializaTarefa.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Adquire lock, registra estado, cria
// diretório de trabalho e atualiza status na API.
// ─────────────────────────────────────────────────────

import type {
  ContextoExecucao,
  Passo,
  ServicoLock,
  ServicoEstado,
} from '../../interfaces';
import { StepName } from '../../interfaces';
import type { Logger } from '../../interfaces/logger';

/** Contrato mínimo para operações de filesystem */
export interface FileSystemMinimo {
  mkdir(caminho: string, opcoes: { recursive: boolean }): Promise<void>;
}

/** Contrato mínimo para o cliente HTTP da API */
export interface ClienteApiStatus {
  buscarStatusPorNome(apiUrl: string, nome: string): Promise<{ id: number } | null>;
  atualizarStatusTarefa(apiUrl: string, taskId: number | string, statusId: number): Promise<void>;
}

export interface DependenciasInicializaTarefa {
  logger: Logger;
  lockService: ServicoLock;
  stateService: ServicoEstado;
  fileSystem: FileSystemMinimo;
  clienteApi: ClienteApiStatus;
  path: {
    join(...segments: string[]): string;
  };
}

export class PassoInicializaTarefa implements Passo {
  readonly name = StepName.INICIALIZA_TAREFA;

  private readonly logger: Logger;
  private readonly lockService: ServicoLock;
  private readonly stateService: ServicoEstado;
  private readonly fileSystem: FileSystemMinimo;
  private readonly clienteApi: ClienteApiStatus;
  private readonly pathUtil: { join(...segments: string[]): string };

  constructor(deps: DependenciasInicializaTarefa) {
    this.logger = deps.logger;
    this.lockService = deps.lockService;
    this.stateService = deps.stateService;
    this.fileSystem = deps.fileSystem;
    this.clienteApi = deps.clienteApi;
    this.pathUtil = deps.path;
  }

  async executar(ctx: ContextoExecucao): Promise<void> {
    const { tarefaAtual, config, controleExecucao } = ctx;

    if (!tarefaAtual) return;

    await this.logger.info(`⚙️ Inicializando ambiente para tarefa ${tarefaAtual.id}...`);

    // 1. LOCK
    if (!(await this.adquirirLock(tarefaAtual.id, controleExecucao))) return;

    // 2. ESTADO
    await this.stateService.registerActiveTask(tarefaAtual.id);

    // 3. DISCO
    if (!(await this.criarDiretorioTrabalho(tarefaAtual.id, config.TASKS_DIR, controleExecucao))) return;

    // 4. API (degradação graciosa)
    await this.atualizarStatusNaApi(
      config.API_URL,
      tarefaAtual.id,
      config.STATUS.IN_PROGRESS
    );
  }

  private async adquirirLock(
    taskId: number | string,
    controle: ContextoExecucao['controleExecucao']
  ): Promise<boolean> {
    const adquirido = await this.lockService.acquireLock(taskId);
    if (!adquirido) {
      await this.logger.erro(
        `❌ Tarefa ${taskId} já está em processamento por outro worker.`
      );
      controle.erroInicializacao = true;
      return false;
    }
    return true;
  }

  private async criarDiretorioTrabalho(
    taskId: number | string,
    tasksDir: string,
    controle: ContextoExecucao['controleExecucao']
  ): Promise<boolean> {
    try {
      const taskDir = this.pathUtil.join(tasksDir, taskId.toString());
      await this.fileSystem.mkdir(taskDir, { recursive: true });
      controle.taskDir = taskDir;
      await this.logger.info('📁 Diretório de trabalho isolado criado.');
      return true;
    } catch (erro: unknown) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      await this.logger.erro(
        `⚠️ Erro fatal ao criar diretório de trabalho: ${mensagem}`
      );
      controle.erroInicializacao = true;
      return false;
    }
  }

  private async atualizarStatusNaApi(
    apiUrl: string,
    taskId: number | string,
    nomeStatus: string
  ): Promise<void> {
    try {
      const status = await this.clienteApi.buscarStatusPorNome(apiUrl, nomeStatus);
      if (status) {
        await this.clienteApi.atualizarStatusTarefa(apiUrl, taskId, status.id);
        await this.logger.info('✅ Status atualizado para "Em Andamento".');
      } else {
        await this.logger.info(
          `⚠️ Status "${nomeStatus}" não encontrado na API.`
        );
      }
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : String(error);
      await this.logger.info(
        `⚠️ Erro ao atualizar status na API: ${mensagem} (Ignorando...)`
      );
    }
  }
}
