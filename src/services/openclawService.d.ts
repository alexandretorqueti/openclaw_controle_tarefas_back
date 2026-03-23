declare const spawn: any;
declare const fs: any;
declare const ToolCallService: any;
declare const CommandExecutor: any;
declare const log: any;
declare const OPENCLAW_NODE: string;
declare const OPENCLAW_MJS: string;
/**
 * Serviço auxiliar para gerenciar configurações de agentes
 * Usa o agentService existente para obter informações dinâmicas
 */
declare class AgentConfigService {
    /**
     * Obtém configurações específicas para um agente usando agentService
     */
    static getAgentConfig(agentName: any): Promise<{
        model: any;
        thinking: string;
        tools: string[];
        browserProfile: string;
        execElevated: string;
        workspace: any;
        agentId: any;
        agentName: any;
        bindings: any;
        bindingsList: any;
    }>;
    /**
     * Configuração padrão para agentes não encontrados
     */
    static getDefaultConfig(agentName: any): {
        model: string;
        thinking: string;
        tools: string[];
        browserProfile: string;
        execElevated: string;
        workspace: any;
        agentId: any;
        agentName: any;
        bindings: number;
        bindingsList: any[];
    };
    /**
     * Obtém workspace padrão baseado no nome do agente
     */
    static getDefaultWorkspace(agentName: any): any;
    /**
     * Obtém ferramentas padrão baseadas no tipo de agente
     */
    static getDefaultToolsForAgent(agentType: any): string[];
    /**
     * Carrega contexto do agente (SOUL.md, USER.md, MEMORY.md)
     * Usa agentService.readAgentFile quando possível
     */
    static loadAgentContext(agentName: any): Promise<{
        soul: string;
        user: string;
        memory: string;
        recentMemory: string;
    }>;
}
declare class OpenClawService {
    /**
     * Executa uma chamada ao agente via CLI do OpenClaw
     */
    static execute(taskId: any, inputMessage: any, agent: any, model: any, tasksDir: any, terminalLogFile: any, projectPath: any, timeoutMs?: number): Promise<unknown>;
    /**
     * Executa uma chamada ao agente com configuração otimizada
     * Versão melhorada com fallback inteligente e diagnóstico
     */
    static executeOptimized(taskId: any, inputMessage: any, agent: any, model: any, tasksDir: any, terminalLogFile: any, projectPath: any, timeoutMs?: number, options?: {}): Promise<any>;
    /**
     * Executa uma chamada ao agente, mas se ele falhar ou travar,
     * tenta novamente com um agente de backup (Fallback).
     * Mantido para compatibilidade
     */
    static executeWithFallback(taskId: any, inputMessage: any, primaryAgent: any, fallbackAgent: any, model: any, tasksDir: any, terminalLogFile: any, projectPath: any, timeoutMs?: number): Promise<any>;
}
