// src/services/monitorStateService.js
// Servico de gerenciamento de estado do monitor

const fs = require('fs').promises;
const path = require('path');
const { fileExists, safeReadFile, safeWriteFile } = require('../utils/fileUtils');
const { safeParse, safeStringify } = require('../utils/jsonUtils');

class MonitorStateService {
  constructor(tasksDir) {
    this.tasksDir = tasksDir;
    this.stateFilePath = path.join(tasksDir, 'monitor-state.json');
  }

  /**
   * Le o estado atual do monitor
   * @returns {Promise<Object>}
   */
  async readState() {
    const content = await safeReadFile(this.stateFilePath);
    if (!content) {
      return { active_tasks: {} };
    }

    const state = safeParse(content, { active_tasks: {} });
    if (!state.active_tasks) {
      state.active_tasks = {};
    }

    return state;
  }

  /**
   * Salva o estado do monitor
   * @param {Object} state - Estado a salvar
   * @returns {Promise<boolean>}
   */
  async saveState(state) {
    return await safeWriteFile(this.stateFilePath, safeStringify(state));
  }

  /**
   * Registra uma tarefa como ativa
   * @param {string} taskId - ID da tarefa
   * @returns {Promise<void>}
   */
  async registerActiveTask(taskId) {
    const state = await this.readState();
    state.active_tasks[taskId] = { startTime: Date.now() };
    await this.saveState(state);
  }

  /**
   * Remove uma tarefa do estado ativo
   * @param {string} taskId - ID da tarefa
   * @returns {Promise<void>}
   */
  async cleanupTask(taskId) {
    const state = await this.readState();
    if (state.active_tasks && state.active_tasks[taskId]) {
      delete state.active_tasks[taskId];
      await this.saveState(state);
    }
  }

  /**
   * Obtem informacoes de uma tarefa ativa
   * @param {string} taskId - ID da tarefa
   * @returns {Promise<Object|null>}
   */
  async getActiveTask(taskId) {
    const state = await this.readState();
    return state.active_tasks?.[taskId] || null;
  }

  /**
   * Obtem todas as tarefas ativas
   * @returns {Promise<Object>}
   */
  async getActiveTasks() {
    const state = await this.readState();
    return state.active_tasks || {};
  }

  /**
   * Obtem o tempo de execucao de uma tarefa
   * @param {string} taskId - ID da tarefa
   * @returns {Promise<number|null>} Tempo em ms
   */
  async getTaskElapsedTime(taskId) {
    const task = await this.getActiveTask(taskId);
    if (!task || !task.startTime) {
      return null;
    }
    return Date.now() - task.startTime;
  }

  /**
   * Verifica se uma tarefa esta em timeout
   * @param {string} taskId - ID da tarefa
   * @param {number} timeoutMs - Tempo limite em ms
   * @returns {Promise<boolean>}
   */
  async isTaskTimedOut(taskId, timeoutMs) {
    const elapsed = await this.getTaskElapsedTime(taskId);
    return elapsed !== null && elapsed > timeoutMs;
  }

  /**
   * Limpa completamente o estado
   * @returns {Promise<void>}
   */
  async clearState() {
    try {
      if (await fileExists(this.stateFilePath)) {
        await fs.unlink(this.stateFilePath);
      }
    } catch (error) {
      console.error(`Erro ao limpar estado: ${error.message}`);
    }
  }
}

module.exports = MonitorStateService;
