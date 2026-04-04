import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// @ts-ignore - Assumindo que o agentCache pode não ter tipos definidos ainda
import * as agentCache from './agentCache';
import { Agent, AgentIdentityUpdate, CommandError } from '../interfaces/interfaceAgentService';

export class AgentService {
    static async execOpenClawCommand(command: string, args: string[] = []): Promise<any>  {
        return new Promise((resolve, reject) => {
            // Não adicionar --json para comandos 'config set' pois interfere com os valores
            const shouldAddJson = !(command === 'config' && args[0] === 'set');
            const fullArgs = [command, ...args, ...(shouldAddJson ? ['--json'] : [])];
            
            const OPENCLAW_NODE = process.env.OPENCLAW_NODE || '/home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin/node';
            const OPENCLAW_PATH = '/home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/lib/node_modules/openclaw/openclaw.mjs';
            const child = spawn(OPENCLAW_NODE, [OPENCLAW_PATH, ...fullArgs], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
            });
            
            child.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
            });
            
            child.on('close', (code: number | null) => {
            if (code !== 0) {
                const error = new Error(`Comando openclaw falhou com código ${code}: ${stderr}`) as CommandError;
                error.stderr = stderr;
                error.code = code;
                return reject(error);
            }
            
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (parseError) {
                // Se não for JSON válido, retorna a saída bruta
                resolve({ raw: stdout.trim() });
            }
            });
            
            child.on('error', (error: Error) => {
            reject(new Error(`Falha ao executar openclaw: ${error.message}`));
            });
        });
    };

    /**
     * Busca agentes diretamente do OpenClaw (sem cache)
     * @returns {Promise<Agent[]>} - Lista de agentes
     */
    static async _fetchAgentsDirectly(): Promise<Agent[]>  {
        try {
            const result: any = await this.execOpenClawCommand('agents', ['list']);
            // O comando retorna um array de agentes
            const agents: any[] = Array.isArray(result) ? result : [];
            
            // Garantir que cada agente tenha uma estrutura consistente
            return agents.map(agent => {
            // Função para limpar strings que podem vir com aspas extras
            const cleanString = (str: any): string => {
                if (!str) return '';
                // Remove aspas duplas no início e no fim
                let cleaned = str.toString().trim();
                if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                cleaned = cleaned.slice(1, -1);
                }
                return cleaned;
            };
            
            // Obter valores limpos
            const rawEmoji = cleanString(agent.identity?.emoji || agent.identityEmoji || agent.emoji || '');
            const rawAvatar = cleanString(agent.identity?.avatar || agent.avatar || '');
            
            // Detectar se o emoji é uma URL (imagem)
            const isUrl = (str: string): boolean => {
                if (!str) return false;
                return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:image');
            };
            
            let finalEmoji = rawEmoji;
            let finalAvatar = rawAvatar;
            
            // Se emoji for URL e avatar estiver vazio, mover para avatar
            if (isUrl(rawEmoji) && !rawAvatar) {
                finalAvatar = rawEmoji;
                finalEmoji = ''; // Limpar emoji pois é uma imagem
            }
            
            // Bindings: tenta pegar do campo bindings ou calcula baseado em regras
            const bindingsCount = agent.bindings ? Array.isArray(agent.bindings) ? agent.bindings.length : 0 : 0;
            const bindingsList = agent.bindings && Array.isArray(agent.bindings) ? agent.bindings : [];
            
            return {
                id: agent.id || '',
                name: cleanString(agent.name || agent.identityName || ''),
                identity: {
                name: cleanString(agent.identity?.name || agent.identityName || agent.name || ''),
                emoji: finalEmoji,
                avatar: finalAvatar,
                model: cleanString(agent.model || '') // Movendo model para dentro de identity
                },
                bindings: bindingsCount,  // Número total de bindings
                bindingsList: bindingsList,  // Lista de bindings ativos
                workspace: agent.workspace || '',
                createdAt: agent.createdAt || new Date().toISOString(),
                updatedAt: agent.updatedAt || new Date().toISOString()
            };
            });
        } catch (error: any) {
            console.error('Erro ao buscar agentes diretamente:', error.message);
            throw error;
        }
    };

    /**
     * Lista todos os agentes (com cache de 1 hora)
     * @returns {Promise<Agent[]>} - Lista de agentes
     */
    static async listAgents(): Promise<Agent[]>  {
        try {
            // Usa o cache com função de fallback para buscar diretamente
            const agents = await agentCache.getAgents(() => this._fetchAgentsDirectly());
            return agents;
        } catch (error: any) {
            console.error('Erro ao listar agentes (com cache):', error.message);
            throw error;
        }
    };

    /**
     * Adiciona um novo agente
     * @param {string} name - Nome do agente
     * @param {string} [workspace] - Caminho do workspace
     * @returns {Promise<any>} - Agente criado
     */
    static async addAgent(name: string, workspace?: string): Promise<any>  {
        try {
            const args = ['add', name];
            if (workspace) {
            args.push('--workspace', workspace);
            }
            
            const result = await this.execOpenClawCommand('agents', args);
            
            // Invalida o cache para forçar atualização na próxima requisição
            agentCache.invalidate();
            
            return result;
        } catch (error: any) {
            console.error('Erro ao adicionar agente:', error.message);
            throw error;
        }
    };

    /**
     * Atualiza a identidade de um agente
     * @param {string} agentId - ID do agente
     * @param {AgentIdentityUpdate} identity - Dados da identidade
     * @returns {Promise<{success: boolean, agentId: string}>} - Resultado da operação
     */
    static async setAgentIdentity(agentId: string, identity: AgentIdentityUpdate): Promise<{success: boolean, agentId: string}> {
        try {
            
            // Atualiza identidade (name, emoji, avatar) via CLI agents set-identity
            const identityArgs = ['set-identity', '--agent', agentId];
            if (identity.name !== undefined) {
            identityArgs.push('--name', identity.name);
            }
            if (identity.emoji !== undefined) {
            identityArgs.push('--emoji', identity.emoji);
            }
            if (identity.avatar !== undefined) {
            // Se avatar for string vazia ou null, não enviar (OpenClaw valida)
            if (identity.avatar && identity.avatar.trim() !== '') {
                identityArgs.push('--avatar', identity.avatar);
            }
            // Se for string vazia, não adiciona --avatar (mantém como está)
            }
            
            try {
            await this.execOpenClawCommand('agents', identityArgs);
            } catch (error: any) {
            // Se falhar por validação de avatar, tentar sem avatar
            if (error.message && error.message.includes('identity.avatar must stay within')) {
                console.warn(`⚠️ Avatar validation failed for agent ${agentId}, removing avatar from update`);
                // Remover --avatar dos args e tentar novamente
                const filteredArgs = identityArgs.filter(arg => arg !== '--avatar' && !(identity.avatar && arg === identity.avatar));
                await this.execOpenClawCommand('agents', filteredArgs);
            } else {
                throw error;
            }
            }

            // Atualiza modelo via config (agents.list[<index>].model)
            if (identity.model !== undefined) {
            const agentsResult: any = await this.execOpenClawCommand('agents', ['list', '--json']);
            const output = typeof agentsResult === 'object' ? agentsResult : (agentsResult.stdout || '');

            const agents: any[] = output;
            const agentIndex = agents.findIndex(agent => agent.id === agentId);
            if (agentIndex === -1) {
                throw new Error(`Agente '${agentId}' não encontrado.`);
            }
            await this.execOpenClawCommand('config', ['set', `agents.list.${agentIndex}.model`, identity.model]);
            }

            // Atualiza workspace via config (agents.list[<index>].workspace)
            if (identity.workspace !== undefined) {
            const agentsResult: any = await this.execOpenClawCommand('agents', ['list', '--json']);
            const output = typeof agentsResult === 'object' ? agentsResult : (agentsResult.stdout || '');

            const agents: any[] = output;
            const agentIndex = agents.findIndex(agent => agent.id === agentId);
            if (agentIndex === -1) {
                throw new Error(`Agente '${agentId}' não encontrado.`);
            }
            await this.execOpenClawCommand('config', ['set', `agents.list.${agentIndex}.workspace`, identity.workspace]);
        }

        // Invalida o cache para forçar atualização na próxima requisição
        agentCache.invalidate();
        
        // Aguarda um momento para garantir que OpenClaw processou o comando
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Força recarga imediata do cache
        await agentCache.getAgents(() => this._fetchAgentsDirectly());
        
        return { success: true, agentId };
    } catch (error: any) {
        console.error('❌ agentService: Erro ao atualizar identidade do agente:', error.message);
        throw error;
    }
    };

    /**
     * Adiciona um binding a um agente
     * @param {string} agentId - ID do agente
     * @param {string} binding - Binding no formato canal:conta
     * @returns {Promise<any>} - Resultado da operação
     */
    static async bindAgent(agentId: string, binding: string): Promise<any> {
        try {
            const result = await this.execOpenClawCommand('agents', [
            'bind',
            '--agent', agentId,
            '--bind', binding
            ]);
            
            // Invalida o cache para forçar atualização na próxima requisição
            agentCache.invalidate();
            
            return result;
        } catch (error: any) {
            console.error('Erro ao adicionar binding:', error.message);
            throw error;
        }
    };

    /**
     * Remove um binding de um agente
     * @param {string} agentId - ID do agente
     * @param {string} binding - Binding no formato canal:conta
     * @returns {Promise<any>} - Resultado da operação
     */
    static async unbindAgent(agentId: string, binding: string): Promise<any> {
        try {
            const result = await this.execOpenClawCommand('agents', [
            'unbind',
            '--agent', agentId,
            '--bind', binding
            ]);
            
            // Invalida o cache para forçar atualização na próxima requisição
            agentCache.invalidate();
            
            return result;
        } catch (error: any) {
            console.error('Erro ao remover binding:', error.message);
            throw error;
        }
    };

    /**
     * Exclui um agente
     * @param {string} agentId - ID do agente
     * @returns {Promise<any>} - Resultado da operação
     */
    static async deleteAgent(agentId: string): Promise<any> {
        try {
            // Adiciona --force para sessões não-interativas
            const result = await this.execOpenClawCommand('agents', ['delete', agentId, '--force']);
            
            // Invalida o cache para forçar atualização na próxima requisição
            agentCache.invalidate();
            
            return result;
        } catch (error: any) {
            console.error('Erro ao excluir agente:', error.message);
            throw error;
        }
    };

    /**
     * Obtém informações detalhadas de um agente
     * @param {string} agentId - ID do agente
     * @returns {Promise<Agent>} - Informações do agente
     */
    static async getAgentDetails(agentId: string): Promise<Agent>  {
        try {
            // Primeiro listamos todos os agentes
            const agents = await this.listAgents();
            const agent = agents.find(a => a.id === agentId);
            
            if (!agent) {
            throw new Error(`Agente com ID ${agentId} não encontrado`);
            }
            
            return agent;
        } catch (error: any) {
            console.error('Erro ao obter detalhes do agente:', error.message);
            throw error;
        }
    };

    /**
     * Valida se um agente existe
     * @param {string} agentId - ID do agente
     * @returns {Promise<boolean>} - True se o agente existe
     */
    static async agentExists(agentId: string): Promise<boolean> {
        try {
            const agents = await this.listAgents();
            return agents.some(a => a.id === agentId);
        } catch (error: any) {
            console.error('Erro ao verificar existência do agente:', error.message);
            return false;
        }
    };

    /**
     * Lê um arquivo do workspace do agente
     * @param {string} agentId - ID do agente
     * @param {string} filename - Nome do arquivo (IDENTITY.md ou SOUL.md)
     * @returns {Promise<string>} - Conteúdo do arquivo
     */
    static async readAgentFile(agentId: string, filename: string): Promise<string>  {
        try {
            // Primeiro verificar se o agente existe
            const exists = await this.agentExists(agentId);
            if (!exists) {
            throw new Error(`Agente com ID ${agentId} não encontrado`);
            }
            
            // Obter detalhes do agente para pegar o workspace
            const agentDetails = await this.getAgentDetails(agentId);
            const workspace = agentDetails.workspace;
            
            if (!workspace) {
            throw new Error(`Agente ${agentId} não tem workspace configurado`);
            }
            
            // Construir caminho completo do arquivo
            const filePath = path.join(workspace, filename);
            
            // Verificar se o arquivo existe
            try {
            await fs.access(filePath);
            } catch (accessError) {
            // Arquivo não existe, retornar string vazia
            return '';
            }
            
            // Ler o conteúdo do arquivo
            const content = await fs.readFile(filePath, 'utf8');
            return content;
        } catch (error: any) {
            console.error(`Erro ao ler arquivo ${filename} do agente ${agentId}:`, error.message);
            
            // Se o arquivo não existir, retornar string vazia (não é erro)
            if (error.code === 'ENOENT' || (error.message && error.message.includes('ENOENT'))) {
            return '';
            }
            
            throw error;
        }
    };

    /**
     * Escreve em um arquivo do workspace do agente
     * @param {string} agentId - ID do agente
     * @param {string} filename - Nome do arquivo (IDENTITY.md ou SOUL.md)
     * @param {string} content - Conteúdo a ser escrito
     * @returns {Promise<any>} - Resultado da operação
     */
    static async writeAgentFile(agentId: string, filename: string, content: string): Promise<any>  {
        try {
            // Primeiro verificar se o agente existe
            const exists = await this.agentExists(agentId);
            if (!exists) {
            throw new Error(`Agente com ID ${agentId} não encontrado`);
            }
            
            // Obter detalhes do agente para pegar o workspace
            const agentDetails = await this.getAgentDetails(agentId);
            const workspace = agentDetails.workspace;
            
            if (!workspace) {
            throw new Error(`Agente ${agentId} não tem workspace configurado`);
            }
            
            // Construir caminho completo do arquivo
            const filePath = path.join(workspace, filename);
            
            // Garantir que o diretório existe
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            
            // Escrever o conteúdo no arquivo
            await fs.writeFile(filePath, content, 'utf8');
            
            return {
            success: true,
            message: `Arquivo ${filename} atualizado com sucesso no workspace do agente`,
            filePath,
            agentId,
            workspace
            };
        } catch (error: any) {
            console.error(`Erro ao escrever no arquivo ${filename} do agente ${agentId}:`, error.message);
            throw error;
        }
    };

}