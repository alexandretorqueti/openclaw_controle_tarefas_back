import { AgentConfig, AgentData, AgentContext, AgentIdentity  } from '../interfaces/interfaceAgentConfig';
import { AgentService } from './agentService';
import { log } from '../../../../src/aux/logger';

export class AgentConfigService {
  /**
   * Obtém configurações específicas para um agente usando AgentService
   */
  static async getAgentConfig(agentName: string): Promise<AgentConfig> {
    try {
      // Importar AgentService dinamicamente (usamos 'any' para evitar erros caso não haja .d.ts no AgentService antigo)
      
      // Listar todos os agentes
      const agents: AgentData[] = await AgentService.listAgents();
      
      // Encontrar o agente pelo nome (pode ser ID ou nome)
      const agent = agents.find((a: AgentData) => 
        a.id === agentName || 
        a.name === agentName || 
        (a.identity && a.identity.name === agentName)
      );
      
      if (!agent) {
        // @ts-ignore - Ignorando caso o log seja global
        await log(`⚠️ [AgentConfig] Agente "${agentName}" não encontrado via AgentService`);
        return this.getDefaultConfig(agentName);
      }
      
      // Configurações baseadas no tipo de agente
      const agentType = agentName.toLowerCase();
      let config: AgentConfig = {
        model: agent.identity?.model || 'deepseek/deepseek-chat',
        thinking: 'on',
        tools: this.getDefaultToolsForAgent(agentType),
        browserProfile: 'user',
        execElevated: 'allowlist',
        workspace: agent.workspace || this.getDefaultWorkspace(agentName),
        agentId: agent.id,
        agentName: agent.name || agent.identity?.name || agentName,
        bindings: agent.bindings || 0,
        bindingsList: agent.bindingsList || []
      };
      
      // Ajustar configurações baseadas no tipo de agente
      if (agentType.includes('programador') || agentType.includes('developer')) {
        config.model = config.model || 'gpt-4-turbo';
        config.tools = ['exec', 'read', 'write', 'edit', 'browser', 'process', 'web_search', 'web_fetch'];
      } else if (agentType.includes('analista') || agentType.includes('analyst')) {
        config.model = config.model || 'claude-3-opus';
        config.tools = ['read', 'exec', 'browser', 'web_search', 'web_fetch', 'process', 'web_fetch'];
      } else if (agentType.includes('main') || agentType.includes('jarbas')) {
        config.model = config.model || 'deepseek/deepseek-chat';
        config.tools = ['exec', 'read', 'write', 'edit', 'browser', 'process', 'web_search', 'web_fetch'];
      }
      
      // @ts-ignore
      await log(`⚙️ [AgentConfig] Configuração obtida para ${agentName}: modelo=${config.model}, workspace=${config.workspace}`);
      return config;
      
    } catch (error: any) {
      // @ts-ignore
      await log(`⚠️ [AgentConfig] Erro ao obter configuração via AgentService: ${error.message}`);
      return this.getDefaultConfig(agentName);
    }
  }
  
  /**
   * Configuração padrão para agentes não encontrados
   */
  static getDefaultConfig(agentName: string): AgentConfig {
    const agentType = agentName.toLowerCase();
    
    // Tentar inferir workspace baseado no nome
    const defaultWorkspace = this.getDefaultWorkspace(agentName);
    
    const defaultConfig: AgentConfig = {
      model: 'deepseek/deepseek-chat',
      thinking: 'on',
      tools: this.getDefaultToolsForAgent(agentType),
      browserProfile: 'user',
      execElevated: 'deny',
      workspace: defaultWorkspace,
      agentId: agentName,
      agentName: agentName,
      bindings: 0,
      bindingsList: []
    };
    
    return defaultConfig;
  }
  
  /**
   * Obtém workspace padrão baseado no nome do agente
   */
  static getDefaultWorkspace(agentName: string): string {
    const os = require('os');
    const path = require('path');
    
    // Mapeamento de nomes de agentes para workspaces
    const workspaceMap: Record<string, string> = {
      'programadormonitortarefas': path.join(os.homedir(), 'agentes', 'programadormonitortarefas'),
      'analistamonitortarefas': path.join(os.homedir(), 'agentes', 'analistamonitortarefas'),
      'main': path.join(os.homedir(), 'agentes', 'jarbas'),
      'jarbas': path.join(os.homedir(), 'agentes', 'jarbas')
    };
    
    return workspaceMap[agentName] || path.join(os.homedir(), 'agentes', agentName);
  }
  
  /**
   * Obtém ferramentas padrão baseadas no tipo de agente
   */
  static getDefaultToolsForAgent(agentType: string): string[] {
    if (agentType.includes('programador') || agentType.includes('developer')) {
      return ['exec', 'read', 'write', 'edit', 'browser', 'process'];
    } else if (agentType.includes('analista') || agentType.includes('analyst')) {
      return ['read', 'exec', 'browser', 'web_search', 'web_fetch'];
    } else {
      return ['exec', 'read', 'write', 'edit'];
    }
  }
  
  /**
   * Carrega contexto do agente (SOUL.md, USER.md, MEMORY.md)
   * Usa AgentService.readAgentFile quando possível
   */
  static async loadAgentContext(agentName: string): Promise<AgentContext | null> {
    try {
      // Primeiro tentar usar AgentService
     
      const config = await this.getAgentConfig(agentName);
      
      const context: AgentContext = {
        soul: '',
        user: '',
        memory: '',
        recentMemory: ''
      };
      
      // Tentar ler arquivos via AgentService se tivermos agentId
      if (config.agentId) {
        try {
          context.soul = await AgentService.readAgentFile(config.agentId, 'SOUL.md');
          context.user = await AgentService.readAgentFile(config.agentId, 'USER.md');
          context.memory = await AgentService.readAgentFile(config.agentId, 'MEMORY.md');
        } catch (fileError: any) {
          // Se falhar, tentar ler diretamente do filesystem
          // @ts-ignore
          await log(`⚠️ [AgentConfig] Erro ao ler arquivos via AgentService: ${fileError.message}`);
        }
      }
      
      // Se algum arquivo estiver vazio, tentar ler diretamente do filesystem
      const fsSync = require('fs');
      const path = require('path');
      
      if (!context.soul && config.workspace && fsSync.existsSync(config.workspace)) {
        const soulPath = path.join(config.workspace, 'SOUL.md');
        if (fsSync.existsSync(soulPath)) {
          context.soul = fsSync.readFileSync(soulPath, 'utf8');
        }
      }
      
      if (!context.user && config.workspace && fsSync.existsSync(config.workspace)) {
        const userPath = path.join(config.workspace, 'USER.md');
        if (fsSync.existsSync(userPath)) {
          context.user = fsSync.readFileSync(userPath, 'utf8');
        }
      }
      
      if (!context.memory && config.workspace && fsSync.existsSync(config.workspace)) {
        const memoryPath = path.join(config.workspace, 'MEMORY.md');
        if (fsSync.existsSync(memoryPath)) {
          context.memory = fsSync.readFileSync(memoryPath, 'utf8');
        }
      }
      
      // Carregar memory/YYYY-MM-DD.md mais recente
      if (config.workspace && fsSync.existsSync(config.workspace)) {
        const memoryDir = path.join(config.workspace, 'memory');
        if (fsSync.existsSync(memoryDir)) {
          const files: string[] = fsSync.readdirSync(memoryDir)
            .filter((f: string) => f.endsWith('.md') && f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
            .sort()
            .reverse();
          
          if (files.length > 0) {
            const recentMemoryPath = path.join(memoryDir, files[0]);
            context.recentMemory = fsSync.readFileSync(recentMemoryPath, 'utf8');
          }
        }
      }
      
      // Log do que foi carregado
      const loadedParts: string[] = [];
      if (context.soul) loadedParts.push('SOUL');
      if (context.user) loadedParts.push('USER');
      if (context.memory) loadedParts.push('MEMORY');
      if (context.recentMemory) loadedParts.push('RECENT_MEMORY');
      
      if (loadedParts.length > 0) {
        // @ts-ignore
        await log(`🧠 [AgentConfig] Contexto carregado para ${agentName}: ${loadedParts.join(', ')}`);
      }
      
      return context;
      
    } catch (error: any) {
      // @ts-ignore
      await log(`⚠️ [AgentConfig] Erro ao carregar contexto: ${error.message}`);
      return null;
    }
  }
}