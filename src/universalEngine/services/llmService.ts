import axios from 'axios';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { log } from '../../aux/logger';
import { ContextoExecucaoMotorIA } from '../interfaces/interfaceMonitor';
import { LLMOptions, LLMProvider, LLMResponse } from '../interfaces/interfaceLLM';

export class LLMService {
    private readonly OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT;


    /**
     * Ponto de entrada único para qualquer chamada de IA
     */
    public async execute(prompt: string, options: LLMOptions): Promise<LLMResponse> {
        if (options.provider === LLMProvider.OPENCLAW) {
            return this.executeOpenClaw(prompt, options);
        }
        return this.executeOllama(prompt, options);
    }

    // ============================================================================
    // OLLAMA (Requisição HTTP Direta)
    // ============================================================================
    private async executeOllama(prompt: string, options: LLMOptions): Promise<LLMResponse> {
        try {
            const model = options.model?.replace(/^ollama\//, '') || 'qwen3:4b';
            
            const response = await axios.post(this.OLLAMA_ENDPOINT, {
                model: model,
                prompt: prompt,
                stream: false,
                format: "json"
            }, { timeout: 600000 });

            const content = response.data.response || response.data.thinking || '';
            
            return {
                success: true,
                content: content,
                raw: response.data
            };
        } catch (error: any) {
            await log(`❌ [Ollama] Erro: ${error.message}`);
            return { success: false, content: '', error: error.message };
        }
    }

    // ============================================================================
    // OPENCLAW (Execução CLI via Spawn)
    // ============================================================================
    private async executeOpenClaw(prompt: string, options: LLMOptions): Promise<LLMResponse> {
        return new Promise((resolve) => {
            const agent = options.agentId || 'main';
            const sessionId = options.sessionId || `session-${Date.now()}`;
            
            // Caminhos (ajustados para seu ambiente conforme o JS original)
            const OPENCLAW_NODE = process.env.OPENCLAW_NODE;
            const OPENCLAW_MJS = process.env.OPENCLAW_MJS;

            const childArgs = [
                'agent',
                '--agent', agent,
                '--session-id', sessionId,
                '-m', prompt,
                '--thinking', 'medium'
            ];

            const env = { 
                ...process.env,
                OPENCLAW_MODEL: options.model,
                OPENCLAW_EXEC_HOST: 'host',
                OPENCLAW_BROWSER_TARGET: 'host'
            };

            const child = spawn(OPENCLAW_NODE, [OPENCLAW_MJS, ...childArgs], {
                env,
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });

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
}