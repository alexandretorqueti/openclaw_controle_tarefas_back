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
            return this.executeOpenClaw(prompt, promptSistema, options);
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
    private async executeOpenClaw(prompt: string, promptSistema: string, options: LLMOptions): Promise<LLMResponse> {
        return new Promise(async (resolve) => {
            const agent = options.agentId || 'main';
            const sessionId = options.sessionId || `session-${Date.now()}`;

            const agentConfig: AgentConfig = await AgentConfigService.getAgentConfig(agent);

            // Caminhos (ajustados para seu ambiente conforme o JS original)
            const OPENCLAW_NODE = process.env.OPENCLAW_NODE;
            const OPENCLAW_MJS = process.env.OPENCLAW_MJS;
            const promptBlindado = `${promptSistema}\n\n[MENSAGEM DO USUÁRIO]:\n${prompt}\n\n⚠️ REGRA CRÍTICA DE SISTEMA: Você DEVE retornar a resposta encapsulada em um bloco markdown de JSON (\`\`\`json ... \`\`\`).`;
            const childArgs = [
                'agent',
                '--agent', agent,
                '--session-id', sessionId,
                '-m', promptBlindado,
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
                env, // certifique-se de que a variável 'env' foi declarada aqui
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            // 1. Variáveis de Estado no escopo correto (Closure)
            let stdout = '';
            let stderr = '';
            let isSettled = false;

            const MAX_SAFE_OUTPUT_LENGTH = 500000;

            // 2. Função unificada de finalização
            const settle = (result: LLMResponse) => {
                if (isSettled) return;
                isSettled = true;
                clearTimeout(timeoutTimer);
                resolve(result);
            };

            // 3. Timeout Global (Iniciado UMA VEZ)
            const timeoutTimer = setTimeout(() => {
                try { child.kill('SIGKILL'); } catch (_) {}
                settle({ 
                    success: false, 
                    content: '',
                    error: `Timeout global atingido (${options.timeout}ms). Erros: ${stderr}` 
                });
            }, options.timeout);

            // 4. Manipuladores de Stream Inline
            child.stdout.on('data', (data) => {
                if (isSettled) return;
                
                const text = data.toString();
                stdout += text;
                
                // Print ao vivo
                process.stdout.write(text); // Melhor que log() para streams rápidos

                // Verificações de segurança
                if (stdout.length + stderr.length > MAX_SAFE_OUTPUT_LENGTH || /\x00/.test(text)) {
                    try { child.kill('SIGKILL'); } catch (_) {}
                    settle({ 
                        success: false, 
                        content: '', 
                        error: '[PÂNICO] Dados excessivos ou binários detectados.' 
                    });
                }
            });

            child.stderr.on('data', (data) => {
                if (isSettled) return;
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    settle({ success: true, content: stdout, raw: { stdout, stderr } });
                } else {
                    settle({ success: false, content: stdout, error: `Exit code ${code}: ${stderr}` });
                }
            });

            child.on('error', (err) => {
                settle({ success: false, content: '', error: err.message });
            });
        });
    }
}