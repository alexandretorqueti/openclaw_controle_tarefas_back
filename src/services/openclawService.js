// src/services/openclawService.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const ToolCallService = require('./toolCallService');
const CommandExecutor = require('./commandExecutor');
const { log } =  require('../aux/logger');

const OPENCLAW_NODE = process.env.OPENCLAW_NODE || '/home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin/node';
const OPENCLAW_MJS = process.env.OPENCLAW_MJS || '/home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin/mjs';

/**
 * Serviço auxiliar para gerenciar configurações de agentes
 * Usa o agentService existente para obter informações dinâmicas
 */
class AgentConfigService {
  /**
   * Obtém configurações específicas para um agente usando agentService
   */
  static async getAgentConfig(agentName) {
    try {
      // Importar agentService dinamicamente
      const agentService = require('./agentService');
      
      // Listar todos os agentes
      const agents = await agentService.listAgents();
      
      // Encontrar o agente pelo nome (pode ser ID ou nome)
      const agent = agents.find(a => 
        a.id === agentName || 
        a.name === agentName || 
        (a.identity && a.identity.name === agentName)
      );
      
      if (!agent) {
        await log(`⚠️ [AgentConfig] Agente "${agentName}" não encontrado via agentService`);
        return this.getDefaultConfig(agentName);
      }
      
      // Configurações baseadas no tipo de agente
      const agentType = agentName.toLowerCase();
      let config = {
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
      
      await log(`⚙️ [AgentConfig] Configuração obtida para ${agentName}: modelo=${config.model}, workspace=${config.workspace}`);
      return config;
      
    } catch (error) {
      await log(`⚠️ [AgentConfig] Erro ao obter configuração via agentService: ${error.message}`);
      return this.getDefaultConfig(agentName);
    }
  }
  
  /**
   * Configuração padrão para agentes não encontrados
   */
  static getDefaultConfig(agentName) {
    const agentType = agentName.toLowerCase();
    
    // Tentar inferir workspace baseado no nome
    const defaultWorkspace = this.getDefaultWorkspace(agentName);
    
    const defaultConfig = {
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
  static getDefaultWorkspace(agentName) {
    const os = require('os');
    const path = require('path');
    
    // Mapeamento de nomes de agentes para workspaces
    const workspaceMap = {
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
  static getDefaultToolsForAgent(agentType) {
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
   * Usa agentService.readAgentFile quando possível
   */
  static async loadAgentContext(agentName) {
    try {
      // Primeiro tentar usar agentService
      const agentService = require('./agentService');
      const config = await this.getAgentConfig(agentName);
      
      const context = {
        soul: '',
        user: '',
        memory: '',
        recentMemory: ''
      };
      
      // Tentar ler arquivos via agentService se tivermos agentId
      if (config.agentId) {
        try {
          context.soul = await agentService.readAgentFile(config.agentId, 'SOUL.md');
          context.user = await agentService.readAgentFile(config.agentId, 'USER.md');
          context.memory = await agentService.readAgentFile(config.agentId, 'MEMORY.md');
        } catch (fileError) {
          // Se falhar, tentar ler diretamente do filesystem
          await log(`⚠️ [AgentConfig] Erro ao ler arquivos via agentService: ${fileError.message}`);
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
          const files = fsSync.readdirSync(memoryDir)
            .filter(f => f.endsWith('.md') && f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
            .sort()
            .reverse();
          
          if (files.length > 0) {
            const recentMemoryPath = path.join(memoryDir, files[0]);
            context.recentMemory = fsSync.readFileSync(recentMemoryPath, 'utf8');
          }
        }
      }
      
      // Log do que foi carregado
      const loadedParts = [];
      if (context.soul) loadedParts.push('SOUL');
      if (context.user) loadedParts.push('USER');
      if (context.memory) loadedParts.push('MEMORY');
      if (context.recentMemory) loadedParts.push('RECENT_MEMORY');
      
      if (loadedParts.length > 0) {
        await log(`🧠 [AgentConfig] Contexto carregado para ${agentName}: ${loadedParts.join(', ')}`);
      }
      
      return context;
      
    } catch (error) {
      await log(`⚠️ [AgentConfig] Erro ao carregar contexto: ${error.message}`);
      return null;
    }
  }
}
class OpenClawService {
  /**
   * Executa uma chamada ao agente via CLI do OpenClaw
   */
  static async execute(
    sessionId, 
    inputMessage, 
    agent, 
    model, 
    tasksDir, 
    terminalLogFile, 
    projectPath, 
    timeoutMs = 14400000) {
    return new Promise(async (resolve) => {
      const fsSync = require('fs');
      const path = require('path');
      const os = require('os');
      
      // 1. Obter configuração otimizada para o agente via agentService
      const agentConfig = await AgentConfigService.getAgentConfig(agent);
      await log(`⚙️ [OpenClaw] Configurando agente ${agent} com modelo ${agentConfig.model}`);
      
      // 2. Determinar workspace prioritário
      let spawnCwd;
      if (fsSync.existsSync(agentConfig.workspace)) {
        spawnCwd = agentConfig.workspace;
        await log(`📁 [OpenClaw] Usando workspace do agente: ${agentConfig.workspace}`);
      } else if (projectPath && fsSync.existsSync(projectPath)) {
        spawnCwd = projectPath;
      } else if (tasksDir && fsSync.existsSync(tasksDir)) {
        spawnCwd = tasksDir;
      } else {
        spawnCwd = os.homedir();
      }
      
      // 3. OTIMIZAÇÃO CRÍTICA: Não concatenar SOUL/USER.md no inputMessage!
      // O OpenClaw já carrega os arquivos do workspace como System Prompt automaticamente.
      // Passar isso no -m transforma tudo em User Prompt e confunde o LLM.
      const cleanMessage = inputMessage; 
      await log(`🧠 [OpenClaw] Enviando instrução limpa para o agente (${cleanMessage.length} chars)`);
      
      // 4. Preparar argumentos otimizados para CLI
      // Usar session-id persistente baseado no agente para manter memória
      const persistentSessionId = sessionId;
      const childArgs = [
        'agent', 
        '--agent', agent, 
        '--session-id', persistentSessionId, 
        '-m', cleanMessage, // Passando apenas a tarefa real
        '--timeout', Math.floor(timeoutMs / 1000).toString(),
        '--thinking', 'medium'  // Habilitar thinking para melhor raciocínio
      ];
      
      // 5. Configurar ambiente otimizado com acesso a ferramentas
      const env = { ...process.env };
      delete env.NODE_OPTIONS;
      
      // Configurações de performance e ferramentas
      env.OPENCLAW_THINKING = agentConfig.thinking;
      env.OPENCLAW_MODEL = model || agentConfig.model;
      env.OPENCLAW_BROWSER_PROFILE = agentConfig.browserProfile;
      env.OPENCLAW_BROWSER_TARGET = 'host';  // Acesso ao browser real do usuário
      env.OPENCLAW_BROWSER_ASK = 'off';      // Não pedir aprovação para browser
      env.OPENCLAW_EXEC_ELEVATED = agentConfig.execElevated;
      env.OPENCLAW_EXEC_HOST = 'host';       // Executar no host, não sandbox
      env.OPENCLAW_EXEC_ASK = 'on-miss';     // Pedir aprovação apenas para comandos não permitidos
      env.OPENCLAW_EXEC_SECURITY = 'allowlist'; // Permitir comandos na allowlist
      
      // Allowlist de comandos seguros (não precisam de aprovação)
      env.OPENCLAW_EXEC_ALLOWLIST = [
        'ls', 'pwd', 'cd', 'cat', 'grep', 'find', 'ps', 'df', 'du',
        'git status', 'git log', 'git diff', 'git pull', 'git fetch',
        'npm run', 'npm test', 'npm start', 'node', 'npx',
        'openclaw status', 'openclaw agents', 'openclaw models',
        'curl -s', 'wget -q', 'echo', 'date', 'whoami', 'uname -a'
      ].join('|');
      
      // Configurar memória persistente
      if (agentConfig.workspace) {
        const fs = require('fs');
        const path = require('path');
        const memoryDir = path.join(agentConfig.workspace, 'memory');
        
        // Criar diretório memory/ se não existir
        if (!fs.existsSync(memoryDir)) {
          fs.mkdirSync(memoryDir, { recursive: true });
        }
        
        // Definir path para memória
        env.OPENCLAW_MEMORY_PATH = memoryDir;
      }
      
      // Habilitar ferramentas específicas baseadas na configuração
      if (agentConfig.tools.includes('browser')) {
        env.OPENCLAW_BROWSER_ENABLED = 'true';
        await log(`🌐 [OpenClaw] Browser habilitado para agente ${agent}`);
      }
      
      if (agentConfig.tools.includes('web_search') || agentConfig.tools.includes('web_fetch')) {
        env.OPENCLAW_WEB_ENABLED = 'true';
      }
      
      // Configurar permissões de execução
      env.OPENCLAW_EXEC_SECURITY = 'allowlist';
      env.OPENCLAW_EXEC_ASK = 'on-miss';  // Pedir aprovação para comandos não permitidos
      
      // 6. Iniciar processo do OpenClaw com configuração otimizada
      // REMOVIDO: detached: true (para manter o processo vinculado ao pai e evitar race conditions)
      const child = spawn(OPENCLAW_NODE, [OPENCLAW_MJS, ...childArgs], { 
        cwd: spawnCwd, 
        env, 
        shell: false, 
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // REMOVIDO: child.unref() (para que o Node espere a resolução da Promise corretamente)

      let stdout = ''; 
      let stderr = ''; 
      let isSettled = false; 

      const settle = (result) => { 
        if (isSettled) return; 
        isSettled = true; 
        clearTimeout(timeoutTimer); 
        resolve(result); 
      };

      // 7. Timeout de segurança global
      const timeoutTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (_) {}
        settle({ success: false, errorMessage: `Timeout global atingido (${timeoutMs}ms)`, rawOutput: stdout + stderr });
      }, timeoutMs);

      // Limite de segurança: ~500KB. Nenhum texto útil do LLM passa disso.
      const MAX_SAFE_OUTPUT_LENGTH = 500000; 

      // 8. Captura e processamento otimizado de dados
      const onData = async (data, source) => {
        if (isSettled) return;
        const text = data.toString();
        source === 'stdout' ? (stdout += text) : (stderr += text);
        
        // =========================================================
        // 🚨 KILL SWITCH: DETECÇÃO DE LIXO BINÁRIO NA FONTE
        // =========================================================
        const currentLength = stdout.length + stderr.length;
        const isBinary = /\x00/.test(text); // Detecta Null Bytes

        if (isBinary || currentLength > MAX_SAFE_OUTPUT_LENGTH) {
            await log(`🚨 [PÂNICO DE STREAM] Arquivo binário ou massivo (>${Math.round(currentLength/1024)}KB) detectado. Matando o processo do agente ${agent}!`);
            try { child.kill('SIGKILL'); } catch (_) {}
            
            settle({ 
                success: false, 
                errorMessage: `[SISTEMA] Falha de leitura. O comando retornou lixo binário ou dados excessivos. NÃO TENTE LER ESTE ARQUIVO NOVAMENTE.`, 
                rawOutput: (stdout + stderr).substring(0, 1000) + "\n\n...[TRUNCADO PELO SISTEMA: LIXO BINÁRIO DETECTADO]..."
            });
            return;
        }
        // =========================================================

        // Imprime no console para acompanhamento ao vivo
        log(text);

        // Salva no arquivo de log da tarefa
        if (terminalLogFile) {
            fsSync.appendFile(terminalLogFile, text, () => {});
        }
        
        // ==========================================
        // DETECÇÃO DE FERRAMENTAS E OTIMIZAÇÕES
        // ==========================================
        
        // Detectar uso de ferramentas para logging específico
        if (text.includes('{"name":') || text.includes('tool_call')) {
          await log(`🛠️ [OpenClaw] Agente ${agent} está usando ferramentas...`);
        }
        
        // Detectar uso de browser
        if (text.includes('browser') || text.includes('navigate') || text.includes('snapshot')) {
          await log(`🌐 [OpenClaw] Agente ${agent} está usando browser...`);
        }
        
        // Detectar comandos elevated
        if (text.includes('elevated') || text.includes('sudo') || text.includes('root')) {
          await log(`⚠️ [OpenClaw] Agente ${agent} solicitando permissões elevated...`);
        }
      };

      child.stdout.on('data', (d) => onData(d, 'stdout'));
      child.stderr.on('data', (d) => onData(d, 'stderr'));
      
      // 9. O OpenClaw só avisa quando realmente terminar (ou travar)
      child.on('close', (code) => { 
        settle({ 
            success: code === 0, 
            rawOutput: stdout + stderr, 
            errorMessage: code === 0 ? null : `Processo encerrado com código ${code}` 
        }); 
      });

      child.on('error', (err) => {
        settle({
            success: false,
            rawOutput: stdout + stderr,
            errorMessage: `Erro ao iniciar processo: ${err.message}`
        });
      });
    });
  }

  /**
   * Executa uma chamada ao agente com configuração otimizada
   * Versão melhorada com fallback inteligente e diagnóstico
   */
  static async executeOptimized(
    sessionId, inputMessage, agent, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 14400000,
    options = {}
  ) {
    const {
      enableBrowser = true,
      enableElevated = true,
      enableThinking = true,
      fallbackAgent = 'main',
      maxRetries = 1
    } = options;
    
    await log(`🚀 [OpenClaw] Execução otimizada iniciada para agente ${agent}`);
    
    let lastError = null;
    let finalResult = null;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        if (attempt > 1) {
          await log(`🔄 [OpenClaw] Tentativa ${attempt}/${maxRetries + 1} para agente ${agent}`);
        }
        
        const result = await this.execute(
          sessionId, 
          attempt > 1 ? `${inputMessage}\n\n[RETENTATIVA ${attempt}] A tentativa anterior falhou. Por favor, analise o erro e tente novamente com uma abordagem diferente.` : inputMessage,
          agent, 
          model, 
          tasksDir, 
          terminalLogFile, 
          projectPath, 
          timeoutMs
        );
        
        // Analisar resultado para determinar sucesso
        const success = result.success && !result.errorMessage;
        
        if (success) {
          await log(`✅ [OpenClaw] Execução do agente ${agent} bem-sucedida na tentativa ${attempt}`);
          return { ...result, attempt, success: true };
        } else {
          lastError = result.errorMessage || 'Falha não especificada';
          finalResult = result;
          await log(`⚠️ [OpenClaw] Agente ${agent} falhou na tentativa ${attempt}: ${lastError}`);
          
          if (attempt <= maxRetries) {
            // Aguardar antes de retentar
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
      } catch (error) {
        lastError = error.message;
        await log(`💥 [OpenClaw] Erro na execução do agente ${agent} (tentativa ${attempt}): ${error.message}`);
        
        if (attempt <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }
      
      break;
    }
    
    // Fallback para agente alternativo
    if (fallbackAgent && fallbackAgent !== agent) {
      await log(`🔄 [OpenClaw] Todas as tentativas com ${agent} falharam. Acionando fallback: ${fallbackAgent}`);
      
      const fallbackInput = `${inputMessage}\n\n[SISTEMA - MODO FALLBACK] O agente anterior (${agent}) falhou ao executar esta tarefa. Assuma o controle.`;
      
      return await this.execute(
        sessionId, fallbackInput, fallbackAgent, model, tasksDir, terminalLogFile, projectPath, timeoutMs
      );
    }
    
    return {
      success: false,
      errorMessage: `Falha após ${maxRetries + 1} tentativas: ${lastError}`,
      rawOutput: finalResult ? finalResult.rawOutput : '',
      attempt: maxRetries + 1
    };
  }
  
  /**
   * Executa uma chamada ao agente, mas se ele falhar ou travar, 
   * tenta novamente com um agente de backup (Fallback).
   */
  static async executeWithFallback(
    sessionId, inputMessage, primaryAgent, fallbackAgent, model, tasksDir, terminalLogFile, projectPath, timeoutMs = 14400000
  ) {
     // Exclui as sessões do agente
    return await this.executeOptimized(
      sessionId, inputMessage, primaryAgent, model, tasksDir, terminalLogFile, projectPath, timeoutMs,
      { fallbackAgent, maxRetries: 0 }
    );
  }

/**
   * OPÇÃO NUCLEAR DEFINITIVA (Ataque de Precisão)
   * Limpa fisicamente a pasta de sessões do agente para garantir Amnésia total.
   * Caminho alvo: ~/.openclaw/agents/[agentId]/sessions/
   */
  static async wipeAgentAmnesiaCache(agentId) {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    if (!agentId || agentId === 'main') return;
    
    // O caminho exato que você mapeou!
    const sessionsDir = path.join(os.homedir(), '.openclaw', 'agents', agentId, 'sessions');
    
    try {
      // Verifica se a pasta sessions realmente existe
      const stats = await fs.stat(sessionsDir).catch(() => null);
      if (!stats || !stats.isDirectory()) return;

      // Lê todos os arquivos de sessão que estão lá dentro
      const files = await fs.readdir(sessionsDir);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(sessionsDir, file);
        const fileStat = await fs.stat(filePath);
        
        // Deleta o arquivo de sessão
        if (fileStat.isFile()) {
          await fs.unlink(filePath).catch(()=>{});
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        const { log } = require('../aux/logger');
        await log(`🧹 [Amnésia] Limpeza Cirúrgica: ${deletedCount} arquivos apagados em ~/.openclaw/agents/${agentId}/sessions/`);
      }
    } catch (error) {
      const { log } = require('../aux/logger');
      await log(`⚠️ [Amnésia] Falha ao tentar esvaziar a pasta de sessões: ${error.message}`);
    }
  }
}

module.exports = OpenClawService;

module.exports = OpenClawService;

