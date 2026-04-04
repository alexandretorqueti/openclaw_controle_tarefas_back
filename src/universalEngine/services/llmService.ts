import axios from 'axios';
import { ChildProcess, spawn } from 'child_process';
import { log } from '../../aux/logger';
import { LLMOptions, LLMProvider, LLMResponse } from '../interfaces/interfaceLLM';
import { AgentConfigService } from './agentConfigService';
import { AgentConfig } from '../interfaces/interfaceAgentConfig';
import { sys } from 'typescript';

export class LLMService {
    private readonly OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate';


    /**
     * Ponto de entrada único para qualquer chamada de IA
     */
    public async execute(prompt: string, promptSistema: string, options: LLMOptions): Promise<LLMResponse> {
        if (options.provider === LLMProvider.OPENCLAW) {
            return this.executeOpenClaw(prompt, options);
        }
        return this.executeOllama(prompt, promptSistema, options);
    }

    // ============================================================================
    // OLLAMA (Requisição HTTP Direta)
    // ============================================================================
    private async executeOllama(prompt: string, promptSistema: string, options: LLMOptions): Promise<LLMResponse> {
        try {
            const model = options.model?.replace(/^ollama\//, '');
            
            const response = await axios.post(this.OLLAMA_ENDPOINT, {
                model: model,
                prompt: prompt,
                system: promptSistema,
                stream: false,
                ...(options.format && { format: options.format })
            }, { timeout: options.timeout });

            const content = response.data.response || response.data.thinking || '';
            
            return {
                success: true,
                content: content,
                raw: response.data
            };
        } catch (error: any) {
            await log(`❌ [Ollama] Erro: ${error.response.data.error}`);
            return { success: false, content: '', error: error.response.data.error };
        }
    }

    // ============================================================================
    // OPENCLAW (Execução CLI via Spawn)
    // ============================================================================
    private async executeOpenClaw(prompt: string, options: LLMOptions): Promise<LLMResponse> {
        return new Promise(async (resolve) => {
            const agent = options.agentId || 'main';
            const sessionId = options.sessionId || `session-${Date.now()}`;

            const agentConfig: AgentConfig = await AgentConfigService.getAgentConfig(agent);

            // Caminhos (ajustados para seu ambiente conforme o JS original)
            const OPENCLAW_NODE = process.env.OPENCLAW_NODE;
            const OPENCLAW_MJS = process.env.OPENCLAW_MJS;

            const childArgs = [
                'agent',
                '--agent', agent,
                '--session-id', sessionId,
                '-m', prompt,
                '--thinking', 'medium',
                '--timeout', Math.floor(options.timeout / 1000).toString()
            ];

            const env: NodeJS.ProcessEnv = { 
                ...process.env,
                OPENCLAW_MODEL: options.model,
                OPENCLAW_EXEC_HOST: 'host',
                OPENCLAW_BROWSER_TARGET: 'host',
                OPENCLAW_THINKING: String(agentConfig.thinking), 
                OPENCLAW_BROWSER_PROFILE: agentConfig.browserProfile,
                OPENCLAW_BROWSER_ASK: 'off',
                OPENCLAW_EXEC_ELEVATED: agentConfig.execElevated,
                OPENCLAW_EXEC_ASK: 'on-miss',
                OPENCLAW_EXEC_SECURITY: 'allowlist',
                OPENCLAW_EXEC_ALLOWLIST: [
                    'ls', 'pwd', 'cd', 'cat', 'grep', 'find', 'ps', 'df', 'du',
                    'git status', 'git log', 'git diff', 'git pull', 'git fetch',
                    'npm run', 'npm test', 'npm start', 'node', 'npx',
                    'openclaw status', 'openclaw agents', 'openclaw models',
                    'curl -s', 'wget -q', 'echo', 'date', 'whoami', 'uname -a'
                ].join('|'),
                OPENCLAW_BROWSER_ENABLED: agentConfig.tools.includes('browser') ? 'true' : 'false',
                OPENCLAW_WEB_ENABLED: agentConfig.tools.includes('web_search') ? 'true' : 'false',
            };
           
            delete env.NODE_OPTIONS;

            const child = spawn(OPENCLAW_NODE, [OPENCLAW_MJS, ...childArgs], {
                env,
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            

            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => this.onData(d, 'stdout', options, resolve, stdout, stderr, child, agent));
            child.stderr.on('data', (d) => this.onData(d, 'stderr', options, resolve, stdout, stderr, child, agent));

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, content: stdout });
                } else {
                    resolve({ 
                        success: false, 
                        content: stdout, 
                        error: `OpenClaw exit code ${code}: ${stderr}` 
                    });
                }
            });

            child.on('error', (err) => {
                resolve({ success: false, content: '', error: err.message });
            });
        });
    }

    private async onData(
            data: string, 
            source: string, 
            options: LLMOptions, 
            resolve: (result: LLMResponse) => void,
            stdout: string,
            stderr: string,
            child: ChildProcess,
            agent: string
        ) {

        // Limite de segurança: ~500KB. Nenhum texto útil do LLM passa disso.
        const MAX_SAFE_OUTPUT_LENGTH = 500000; 

        let isSettled = false; 
        const settle = (result) => { 
            if (isSettled) return; 
            isSettled = true; 
            clearTimeout(timeoutTimer); 
            resolve(result); 
        };
        if (isSettled) return;
        const timeoutTimer = setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (_) {}
            settle({ success: false, errorMessage: `Timeout global atingido (${options.timeout}ms)`, rawOutput: stdout + stderr });
        }, options.timeout);
        
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
}