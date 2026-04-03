// monitor/passos/atomicos/PassoInicializaTarefa.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Adquire lock, registra estado, cria
// diretório de trabalho e atualiza status na API.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { TarefaCompleta, ServicoLock, ServicoEstado } from '../../interfaces';
import type { Logger } from '../../interfaces/logger';
import { ConfiguracaoMonitor } from '../../interfaces/tipos';
export interface InicializaTarefaInput {
  tarefa: TarefaCompleta;
  tasksDir: string;
  apiUrl: string;
  statusInProgress: string;
}

export interface DependenciasInicializaTarefa extends DependenciasBase {
  lockService: ServicoLock;
  stateService: ServicoEstado;
  clienteApi: ClienteApiStatus;
  fileSystem: FileSystemMinimo;
  config: ConfiguracaoMonitor;
  path: {
    join(...segments: string[]): string;
  };
}
export interface InicializaTarefaOutput {
  sucesso: boolean;
  taskDir?: string;
}

/** Contrato mínimo para operações de filesystem */
export interface FileSystemMinimo {
  mkdir(caminho: string, opcoes: { recursive: boolean }): Promise<void>;
}

/** Contrato mínimo para o cliente HTTP da API */
export interface ClienteApiStatus {
  buscarStatusPorNome(apiUrl: string, nome: string): Promise<{ id: number } | null>;
  atualizarStatusTarefa(apiUrl: string, taskId: number | string, statusId: number): Promise<void>;
}

export class PassoInicializaTarefa extends PassoBase<InicializaTarefaInput, InicializaTarefaOutput> {
  readonly nome = 'Inicializa Tarefa';

  private readonly lockService: ServicoLock;
  private readonly stateService: ServicoEstado;
  private readonly fileSystem: FileSystemMinimo;
  private readonly clienteApi: ClienteApiStatus;
  private readonly pathUtil: { join(...segments: string[]): string };

  constructor(deps: DependenciasInicializaTarefa) {
    super(deps);
    this.lockService = deps.lockService;
    this.stateService = deps.stateService;
    this.fileSystem = deps.fileSystem;
    this.clienteApi = deps.clienteApi;
    this.pathUtil = deps.path;
  }

  protected async processar(input: InicializaTarefaInput): Promise<InicializaTarefaOutput> {
    const { tarefa, tasksDir, apiUrl, statusInProgress } = input;

    await this.logger.info(`⚙️ Inicializando ambiente para tarefa ${tarefa.id}...`);

    // 1. LOCK
    const adquirido = await this.adquirirLock(tarefa.id);
    if (!adquirido) return { sucesso: false };

    // 2. ESTADO
    await this.stateService.registerActiveTask(tarefa.id);

    // 3. DISCO
    const criacaoDisco = await this.criarDiretorioTrabalho(tarefa.id, tasksDir);
    if (!criacaoDisco.sucesso) return { sucesso: false };

    // 4. API (degradação graciosa)
    await this.atualizarStatusNaApi(apiUrl, tarefa.id, statusInProgress);

    return { sucesso: true, taskDir: criacaoDisco.taskDir };
  }

  private async adquirirLock(taskId: number | string): Promise<boolean> {
    const adquirido = await this.lockService.acquireLock(taskId);
    if (!adquirido) {
      await this.logger.erro(
        `❌ Tarefa ${taskId} já está em processamento por outro worker.`
      );
      return false;
    }
    return true;
  }

  private async criarDiretorioTrabalho(
    taskId: number | string,
    tasksDir: string
  ): Promise<{ sucesso: boolean; taskDir?: string }> {
    try {
      const taskDir = tasksDir;
      await this.fileSystem.mkdir(taskDir, { recursive: true });
      await this.logger.info('📁 Diretório de trabalho isolado criado.');
      return { sucesso: true, taskDir };
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : String(error);
      await this.logger.erro(
        `⚠️ Erro fatal ao criar diretório de trabalho: ${mensagem}`
      );
      return { sucesso: false };
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
