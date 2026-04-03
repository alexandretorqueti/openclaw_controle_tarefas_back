// monitor/services/SessionManagerService.ts
// ─────────────────────────────────────────────────────
// Serviço de Gerenciamento de Sessões Persistente
//
// Responsabilidade:
// 1. Criar e manter sessões OpenClaw por tarefa
// 2. Gerenciar ciclo de vida (timeout, limpeza)
// 3. Facilitar envio de feedback incremental
// 4. Garantir isolamento entre tarefas
//
// Design:
// - Sessão única por tarefa (taskId)
// - Reutilização de sessionId entre turnos de correção
// - Timeout alinhado com TASK_TIMEOUT_MS
// - Limpeza automática de sessões órfãs
// ─────────────────────────────────────────────────────

import type { Logger } from '../interfaces/logger';

export interface SessionInfo {
  sessionId: string;
  taskId: string;
  agent: string;
  createdAt: number;
  lastUsedAt: number;
  feedbackHistory: string[];
  isActive: boolean;
}

export interface SessionManagerDependencies {
  logger: Logger;
  // Configuração pode ser injetada via monitoramento.ts
}

export interface SessionManager {
  /**
   * Cria ou recupera uma sessão para uma tarefa específica
   * @param taskId ID da tarefa
   * @param agent Nome do agente (ex: 'senior-developer')
   * @returns sessionId para uso no OpenClaw
   */
  getOrCreateSession(taskId: string, agent: string): Promise<string>;

  /**
   * Envia feedback para uma sessão existente
   * @param sessionId ID da sessão
   * @param feedback Mensagem de feedback para o agente
   * @param includeHistory Se deve incluir histórico anterior
   * @returns Sucesso da operação
   */
  sendFeedback(sessionId: string, feedback: string, includeHistory?: boolean): Promise<boolean>;

  /**
   * Obtém informações completas de uma sessão
   * @param sessionId ID da sessão
   */
  getSessionInfo(sessionId: string): Promise<SessionInfo | null>;

  /**
   * Fecha uma sessão explicitamente
   * @param sessionId ID da sessão
   */
  closeSession(sessionId: string): Promise<void>;

  /**
   * Limpa sessões inativas (timeout excedido)
   * @param timeoutMs Tempo máximo de inatividade em ms
   */
  cleanupStaleSessions(timeoutMs: number): Promise<number>;

  /**
   * Verifica se uma sessão ainda está ativa (não excedeu timeout)
   * @param sessionId ID da sessão
   * @param timeoutMs Tempo máximo permitido de inatividade
   */
  isSessionActive(sessionId: string, timeoutMs: number): Promise<boolean>;
}

export class SessionManagerService implements SessionManager {
  private readonly logger: Logger;
  private readonly sessions: Map<string, SessionInfo>;
  private readonly sessionByTaskId: Map<string, string>; // taskId -> sessionId

  constructor(deps: SessionManagerDependencies) {
    this.logger = deps.logger;
    this.sessions = new Map();
    this.sessionByTaskId = new Map();
  }

  public async getOrCreateSession(taskId: string, agent: string): Promise<string> {
    // Verificar se já existe sessão para esta tarefa
    const existingSessionId = this.sessionByTaskId.get(taskId);
    
    if (existingSessionId) {
      const sessionInfo = this.sessions.get(existingSessionId);
      if (sessionInfo && await this.isSessionActive(existingSessionId, 300000)) { // 5 minutos default
        // Atualizar timestamp de uso
        sessionInfo.lastUsedAt = Date.now();
        await this.logger.info(`🔄 Reutilizando sessão ${existingSessionId} para tarefa ${taskId}`);
        return existingSessionId;
      } else {
        // Sessão expirada ou não encontrada, limpar
        if (sessionInfo) {
          this.sessions.delete(existingSessionId);
        }
        this.sessionByTaskId.delete(taskId);
      }
    }

    // Criar nova sessão
    const sessionId = this.generateSessionId(taskId, agent);
    const now = Date.now();
    
    const sessionInfo: SessionInfo = {
      sessionId,
      taskId,
      agent,
      createdAt: now,
      lastUsedAt: now,
      feedbackHistory: [],
      isActive: true
    };

    this.sessions.set(sessionId, sessionInfo);
    this.sessionByTaskId.set(taskId, sessionId);

    await this.logger.info(`🆕 Nova sessão criada: ${sessionId} para tarefa ${taskId} (agente: ${agent})`);
    
    return sessionId;
  }

  public async sendFeedback(sessionId: string, feedback: string, includeHistory: boolean = true): Promise<boolean> {
    const sessionInfo = this.sessions.get(sessionId);
    
    if (!sessionInfo) {
      await this.logger.erro(`❌ Tentativa de enviar feedback para sessão inexistente: ${sessionId}`);
      return false;
    }

    // Atualizar timestamp
    sessionInfo.lastUsedAt = Date.now();
    
    // Adicionar ao histórico
    sessionInfo.feedbackHistory.push(`[${new Date().toISOString()}] ${feedback}`);
    
    // Manter histórico limitado (últimos 10 feedbacks)
    if (sessionInfo.feedbackHistory.length > 10) {
      sessionInfo.feedbackHistory = sessionInfo.feedbackHistory.slice(-10);
    }

    await this.logger.info(`📤 Feedback enviado para sessão ${sessionId} (${feedback.length} chars)`);
    
    return true;
  }

  public async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    return this.sessions.get(sessionId) || null;
  }

  public async closeSession(sessionId: string): Promise<void> {
    const sessionInfo = this.sessions.get(sessionId);
    
    if (sessionInfo) {
      // Remover mapeamento taskId -> sessionId
      this.sessionByTaskId.delete(sessionInfo.taskId);
      
      // Remover da memória
      this.sessions.delete(sessionId);
      
      await this.logger.info(`🔒 Sessão fechada: ${sessionId} (tarefa: ${sessionInfo.taskId})`);
    }
  }

  public async cleanupStaleSessions(timeoutMs: number): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Converter Map para array para evitar problemas de iterador
    const sessionsArray = Array.from(this.sessions.entries());
    for (const [sessionId, sessionInfo] of sessionsArray) {
      const inactiveTime = now - sessionInfo.lastUsedAt;
      
      if (inactiveTime > timeoutMs) {
        await this.closeSession(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      await this.logger.info(`🧹 Limpeza de sessões: ${cleanedCount} sessões inativas removidas`);
    }
    
    return cleanedCount;
  }

  public async isSessionActive(sessionId: string, timeoutMs: number): Promise<boolean> {
    const sessionInfo = this.sessions.get(sessionId);
    
    if (!sessionInfo) {
      return false;
    }
    
    const inactiveTime = Date.now() - sessionInfo.lastUsedAt;
    return inactiveTime <= timeoutMs;
  }

  /**
   * Gera um sessionId único e previsível
   * Formato: task-{taskId}-{agent}-{timestamp}
   */
  private generateSessionId(taskId: string, agent: string): string {
    const timestamp = Date.now().toString(36); // Base36 para compactar
    const cleanTaskId = taskId.replace(/[^a-zA-Z0-9-_]/g, '-');
    const cleanAgent = agent.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    return `task-${cleanTaskId}-${cleanAgent}-${timestamp}`;
  }

  /**
   * Método auxiliar para obter histórico formatado para inclusão no prompt
   */
  public getFormattedHistory(sessionId: string, maxItems: number = 3): string {
    const sessionInfo = this.sessions.get(sessionId);
    
    if (!sessionInfo || sessionInfo.feedbackHistory.length === 0) {
      return '';
    }
    
    // Pegar os últimos N feedbacks
    const recentHistory = sessionInfo.feedbackHistory.slice(-maxItems);
    
    let formatted = '\n\n=== HISTÓRICO DE FEEDBACK ANTERIOR ===\n';
    recentHistory.forEach((feedback, index) => {
      formatted += `\n${index + 1}. ${feedback}`;
    });
    formatted += '\n====================================\n';
    
    return formatted;
  }
}