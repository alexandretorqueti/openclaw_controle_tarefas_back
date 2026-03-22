// src/services/MonitorStateService.ts
/**
 * Servico de gerenciamento de estado do monitor
 */

import fs from 'fs/promises';
import * as path from 'path';
import { fileExists, safeReadFile, safeWriteFile } from '../utils/fileUtils';
import { safeParse, safeStringify } from '../utils/jsonUtils';

// Interface para definir a estrutura do estado no arquivo JSON
interface ActiveTask {
  startTime: number;
}

interface MonitorState {
  active_tasks: Record<string, ActiveTask>;
}

class MonitorStateService {
  private tasksDir: string;
  private stateFilePath: string;

  constructor(tasksDir: string) {
    this.tasksDir = tasksDir;
    this.stateFilePath = path.join(tasksDir, 'monitor-state.json');
  }

  /**
   * Le o estado atual do monitor
   */
  async readState(): Promise<MonitorState> {
    const content = await safeReadFile(this.stateFilePath);
    if (!content) {
      return { active_tasks: {} };
    }

    const state = safeParse(content, { active_tasks: {} }) as MonitorState;
    if (!state.active_tasks) {
      state.active_tasks = {};
    }

    return state;
  }

  /**
   * Salva o estado do monitor
   */
  async saveState(state: MonitorState): Promise<boolean> {
    return await safeWriteFile(this.stateFilePath, safeStringify(state));
  }

  /**
   * Registra uma tarefa como ativa
   */
  async registerActiveTask(taskId: string): Promise<void> {
    const state = await this.readState();
    state.active_tasks[taskId] = { startTime: Date.now() };
    await this.saveState(state);
  }

  /**
   * Remove uma tarefa do estado ativo
   */
  async cleanupTask(taskId: string): Promise<void> {
    const state = await this.readState();
    if (state.active_tasks && state.active_tasks[taskId]) {
      delete state.active_tasks[taskId];
      await this.saveState(state);
    }
  }

  /**
   * Obtem informacoes de uma tarefa ativa
   */
  async getActiveTask(taskId: string): Promise<ActiveTask | null> {
    const state = await this.readState();
    return state.active_tasks?.[taskId] || null;
  }

  /**
   * Obtem todas as tarefas ativas
   */
  async getActiveTasks(): Promise<Record<string, ActiveTask>> {
    const state = await this.readState();
    return state.active_tasks || {};
  }

  /**
   * Obtem o tempo de execucao de uma tarefa
   */
  async getTaskElapsedTime(taskId: string): Promise<number | null> {
    const task = await this.getActiveTask(taskId);
    if (!task || !task.startTime) {
      return null;
    }
    return Date.now() - task.startTime;
  }

  /**
   * Verifica se uma tarefa esta em timeout
   */
  async isTaskTimedOut(taskId: string, timeoutMs: number): Promise<boolean> {
    const elapsed = await this.getTaskElapsedTime(taskId);
    return elapsed !== null && elapsed > timeoutMs;
  }

  /**
   * Limpa completamente o arquivo de estado
   */
  async clearState(): Promise<void> {
    try {
      if (await fileExists(this.stateFilePath)) {
        await fs.unlink(this.stateFilePath);
      }
    } catch (error) {
      // Ignora erros ao limpar estado (arquivo pode não existir)
    }
  }
}

export default MonitorStateService;