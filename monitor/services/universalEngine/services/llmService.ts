import axios, { AxiosResponse } from 'axios';
import { ChildProcess, spawn } from 'child_process';
import { log } from '../../../../src/aux/logger';
import { LLMOptions, LLMProvider, LLMResponse, EsquemaSimples } from '../interfaces/interfaceLLM';
import { AgentConfigService } from './agentConfigService';
import { AgentConfig } from '../interfaces/interfaceAgentConfig';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';


import { RetornoOllamaObjeto, RetornoOllamaOpenAI, RetornoOllamaTexto, RetornoOpenclaw } from '../interfaces/interfaceRestostasIA';
import { ExpectedOutcome, OutcomeType } from '../interfaces/interfaceUniversalAgentEngine';
export class LLMService {
    private readonly OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT;


    /**
     * Ponto de entrada único para qualquer chamada de IA
     */
    public async execute(prompt: string, promptSistema: string, options: LLMOptions, expectedOutcomes: ExpectedOutcome[]): Promise<LLMResponse> {
        if (options.provider === LLMProvider.OPENCLAW) {
            return this.executeOpenClaw(prompt, promptSistema, options, expectedOutcomes);
        }
        return this.executeOllama(prompt, promptSistema, options);
    }

    // ============================================================================
    // OLLAMA (Requisição HTTP Direta)
    // ============================================================================
    private async executeOllama(prompt: string, promptSistema: string, options: LLMOptions): Promise<RetornoOpenclaw> {
        try {
            const model = options.model?.replace(/^ollama\//, '');
            
            // 1. A MÁGICA AQUI: Dizemos ao Axios qual é a interface exata que o Ollama vai devolver
            const response: any = await axios.post<any>(this.OLLAMA_ENDPOINT, {
                model: model,
                prompt: prompt,
                system: promptSistema,
                stream: false,
                // O Ollama aceita format: "json" nativamente!
                ...(options.format && { format: options.format })
            }, { timeout: options.timeout });

            // 2. Agora o TypeScript autocompleta e valida o response.data.response
            // (O texto bruto do LLM está seguro aqui dentro)
            const content = (response.data.response) || (response.data.thinking) || '';
            
            // 3. Você converte (adapta) o formato do Ollama para o formato padrão do seu sistema!
            return {
                success: true,
                content: content, 
                raw: response.data // Guarda o RetornoOllamaTexto original caso precise debugar
            };
            
        } catch (error: any) {
            // Prevenção de crash caso o erro não venha da API (ex: erro de rede local)
            const errorMsg = error.response?.data?.error || error.message || 'Erro desconhecido';
            await log(`❌ [Ollama] Erro: ${errorMsg}`);
            
            return { 
                success: false, 
                content: '', 
                error: errorMsg 
            };
        }
    }

    private gerarExemploDeSchema(schema: EsquemaSimples): any {
        if (!schema) return null;

        // 1. Tratamento para Objetos
        if (schema.type === 'object' || schema.properties) {
            const exemploObjeto: Record<string, any> = {};
            
            if (schema.properties) {
            for (const [chave, propriedadeSchema] of Object.entries(schema.properties)) {
                // Chamada recursiva para preencher as propriedades do objeto
                exemploObjeto[chave] = this.gerarExemploDeSchema(propriedadeSchema);
            }
            }
            return exemploObjeto;
        }

        // 2. Tratamento para Arrays
        if (schema.type === 'array' || schema.items) {
            if (schema.items) {
            // Retorna um array contendo 1 item de exemplo (chamada recursiva)
            return [this.gerarExemploDeSchema(schema.items)];
            }
            return []; // Fallback se não tiver itens definidos
        }

        // 3. Tratamento para Tipos Primitivos (string, number, boolean, etc.)
        let representacaoValor = '';

        // Se tiver um tipo definido, usa ele. Se for um array de tipos (ex: ["string", "null"]), pega o primeiro.
        const tipoReal = Array.isArray(schema.type) ? schema.type[0] : schema.type;
        representacaoValor += tipoReal || 'any';

        // Se for um Enum, mostra as opções disponíveis
        if (schema.enum && schema.enum.length > 0) {
            representacaoValor += ` [Valores permitidos: ${schema.enum.join(' | ')}]`;
        }

        // Concatena a descrição, se existir
        if (schema.description) {
            representacaoValor += ` (${schema.description})`;
        }

        return representacaoValor;
    }

    private async wipeAgentAmnesiaCache(agentId: string): Promise<void> {
        // Proteção: não faz nada se não passar o ID ou se for o agente principal
        if (!agentId || agentId === 'main') return;
        
        // Mapeia o caminho exato da pasta de sessões no sistema
        const sessionsDir = path.join(os.homedir(), '.openclaw', 'agents', agentId, 'sessions');
        
        try {
            // Verifica se a pasta sessions realmente existe no disco
            const stats = await fs.promises.stat(sessionsDir).catch(
                (error: NodeJS.ErrnoException) => {
                    console.log(error.message);
                    return null;
                }
            );
            if (!stats || !stats.isDirectory()) return;

            // Lê todos os nomes de arquivos que estão lá dentro
            const files = await fs.promises.readdir(sessionsDir);
            let deletedCount: number = 0;
            
            for (const file of files) {
            const filePath = path.join(sessionsDir, file);
            const fileStat = await fs.promises.stat(filePath);
            
            // Deleta apenas se for um arquivo (ignora se houver subpastas ali dentro)
            if (fileStat.isFile()) {
                // Usa o unlink (que aprendemos agora pouco) para excluir o arquivo
                // O .catch(()=>{}) no final garante que se um arquivo der erro (ex: travado pelo Windows/Linux), 
                // o loop não quebra e continua apagando os outros.
                await fs.promises.unlink(filePath).catch(() => {});
                deletedCount++;
            }
            }
            
            if (deletedCount > 0) {
            await log(`🧹 [Amnésia] Limpeza Cirúrgica: ${deletedCount} arquivos apagados em ~/.openclaw/agents/${agentId}/sessions/`);
            }
        } catch (error: any) {
            await log(`⚠️ [Amnésia] Falha ao tentar esvaziar a pasta de sessões: ${error.message}`);
        }
    }

    // ============================================================================
    // OPENCLAW (Execução CLI via Spawn)
    // ============================================================================
    private async executeOpenClaw(prompt: string, promptSistema: string, options: LLMOptions, expectedOutcomes: ExpectedOutcome[]): Promise<LLMResponse> {
        return new Promise(async (resolve) => {
            const agent = options.agentId || 'main';
            const sessionId = options.sessionId || `session-${Date.now()}`;
            const agentConfig: AgentConfig = await AgentConfigService.getAgentConfig(agent);

            if (options.format) {
                // Converte o objeto options.format em string (com indentação para o LLM entender melhor)
                const exemploDoEsquema = this.gerarExemploDeSchema(options.format as EsquemaSimples);

                for (const outcome of expectedOutcomes) {
                    if (outcome.type === OutcomeType.JSON && outcome.schema) {
                       const formatoDesejado = typeof options.format === 'string' 
                            ? options.format 
                            : JSON.stringify(exemploDoEsquema, null, 2);

                        prompt += `\n\n⚠️ REGRA CRÍTICA DE SISTEMA: Você DEVE retornar a resposta em formato JSON, seguindo EXATAMENTE esta estrutura de exemplo: \n\`\`\`json\n${formatoDesejado}\n\`\`\``;                    
                    }
                }
                
            } else {
                 prompt += `\n\n⚠️ REGRA CRÍTICA DE SISTEMA: Você DEVE retornar a resposta encapsulada em um bloco markdown de JSON (\`\`\`json ... \`\`\`).`;
            }

            // APAGANDO SESSÕES
            await this.wipeAgentAmnesiaCache(agent);

            // 2. RECUPERANDO O CONTEXTO DE DIRETÓRIO (O CWD)
            let spawnCwd: string = os.homedir();
            if (agentConfig.workspace && fs.existsSync(agentConfig.workspace)) {
                spawnCwd = agentConfig.workspace;
            }

            const OPENCLAW_NODE = process.env.OPENCLAW_NODE!; 
            const OPENCLAW_MJS = process.env.OPENCLAW_MJS!;

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
        
            // 3. RECUPERANDO A MEMÓRIA DO AGENTE
            if (agentConfig.workspace) {
                const memoryDir = path.join(agentConfig.workspace, 'memory');
                if (!fs.existsSync(memoryDir)) {
                    fs.mkdirSync(memoryDir, { recursive: true });
                }
                env.OPENCLAW_MEMORY_PATH = memoryDir;
            }

            delete env.NODE_OPTIONS;

            if (!OPENCLAW_NODE || !OPENCLAW_MJS) {
                throw new Error('OPENCLAW_NODE ou OPENCLAW_MJS não foram configurados');
            }
            const child: ChildProcess = spawn(OPENCLAW_NODE, [OPENCLAW_MJS, ...childArgs], {
                cwd: spawnCwd, 
                env, 
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            // 1. Variáveis de Estado no escopo correto (Closure)
            let stdout = '';
            let stderr = '';
            let isSettled = false;

            const MAX_SAFE_OUTPUT_LENGTH = 500000;

            // 2. Função unificada de finalização
            const settle = (result: RetornoOpenclaw) => {
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


