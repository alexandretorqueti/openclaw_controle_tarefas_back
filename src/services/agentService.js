var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const agentCache = require('./agentCache');
/**
 * Executa um comando OpenClaw e retorna a saída JSON
 * @param {string} command - Comando OpenClaw (ex: 'agents', 'list')
 * @param {Array} args - Argumentos do comando
 * @returns {Promise<Object>} - Resultado parseado do JSON
 */
exports.execOpenClawCommand = (command, args = []) => __awaiter(this, void 0, void 0, function* () {
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
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('close', (code) => {
            if (code !== 0) {
                const error = new Error(`Comando openclaw falhou com código ${code}: ${stderr}`);
                error.stderr = stderr;
                error.code = code;
                return reject(error);
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            }
            catch (parseError) {
                // Se não for JSON válido, retorna a saída bruta
                resolve({ raw: stdout.trim() });
            }
        });
        child.on('error', (error) => {
            reject(new Error(`Falha ao executar openclaw: ${error.message}`));
        });
    });
});
/**
 * Busca agentes diretamente do OpenClaw (sem cache)
 * @returns {Promise<Array>} - Lista de agentes
 */
exports._fetchAgentsDirectly = () => __awaiter(this, void 0, void 0, function* () {
    try {
        const result = yield exports.execOpenClawCommand('agents', ['list']);
        // O comando retorna um array de agentes
        const agents = Array.isArray(result) ? result : [];
        // Garantir que cada agente tenha uma estrutura consistente
        return agents.map(agent => {
            var _a, _b, _c;
            // Função para limpar strings que podem vir com aspas extras
            const cleanString = (str) => {
                if (!str)
                    return '';
                // Remove aspas duplas no início e no fim
                let cleaned = str.toString().trim();
                if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                    cleaned = cleaned.slice(1, -1);
                }
                return cleaned;
            };
            // Obter valores limpos
            const rawEmoji = cleanString(((_a = agent.identity) === null || _a === void 0 ? void 0 : _a.emoji) || agent.identityEmoji || agent.emoji || '');
            const rawAvatar = cleanString(((_b = agent.identity) === null || _b === void 0 ? void 0 : _b.avatar) || agent.avatar || '');
            // Detectar se o emoji é uma URL (imagem)
            const isUrl = (str) => {
                if (!str)
                    return false;
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
                    name: cleanString(((_c = agent.identity) === null || _c === void 0 ? void 0 : _c.name) || agent.identityName || agent.name || ''),
                    emoji: finalEmoji,
                    avatar: finalAvatar,
                    model: cleanString(agent.model || '') // Movendo model para dentro de identity
                },
                bindings: bindingsCount,
                bindingsList: bindingsList,
                workspace: agent.workspace || '',
                createdAt: agent.createdAt || new Date().toISOString(),
                updatedAt: agent.updatedAt || new Date().toISOString()
            };
        });
    }
    catch (error) {
        console.error('Erro ao buscar agentes diretamente:', error.message);
        throw error;
    }
});
/**
 * Lista todos os agentes (com cache de 1 hora)
 * @returns {Promise<Array>} - Lista de agentes
 */
exports.listAgents = () => __awaiter(this, void 0, void 0, function* () {
    try {
        // Usa o cache com função de fallback para buscar diretamente
        const agents = yield agentCache.getAgents(() => exports._fetchAgentsDirectly());
        return agents;
    }
    catch (error) {
        console.error('Erro ao listar agentes (com cache):', error.message);
        throw error;
    }
});
/**
 * Adiciona um novo agente
 * @param {string} name - Nome do agente
 * @param {string} workspace - Caminho do workspace
 * @returns {Promise<Object>} - Agente criado
 */
exports.addAgent = (name, workspace) => __awaiter(this, void 0, void 0, function* () {
    try {
        const args = ['add', name];
        if (workspace) {
            args.push('--workspace', workspace);
        }
        const result = yield exports.execOpenClawCommand('agents', args);
        // Invalida o cache para forçar atualização na próxima requisição
        agentCache.invalidate();
        return result;
    }
    catch (error) {
        console.error('Erro ao adicionar agente:', error.message);
        throw error;
    }
});
/**
 * Atualiza a identidade de um agente
 * @param {string} agentId - ID do agente
 * @param {Object} identity - Dados da identidade
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.setAgentIdentity = (agentId, identity) => __awaiter(this, void 0, void 0, function* () {
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
            yield exports.execOpenClawCommand('agents', identityArgs);
        }
        catch (error) {
            // Se falhar por validação de avatar, tentar sem avatar
            if (error.message.includes('identity.avatar must stay within')) {
                console.warn(`⚠️ Avatar validation failed for agent ${agentId}, removing avatar from update`);
                // Remover --avatar dos args e tentar novamente
                const filteredArgs = identityArgs.filter(arg => arg !== '--avatar' && !(identity.avatar && arg === identity.avatar));
                yield exports.execOpenClawCommand('agents', filteredArgs);
            }
            else {
                throw error;
            }
        }
        // Atualiza modelo via config (agents.list[<index>].model)
        if (identity.model !== undefined) {
            const agentsResult = yield exports.execOpenClawCommand('agents', ['list', '--json']);
            const output = typeof agentsResult === 'object' ? agentsResult : (agentsResult.stdout || '');
            const agents = output;
            const agentIndex = agents.findIndex(agent => agent.id === agentId);
            if (agentIndex === -1) {
                throw new Error(`Agente '${agentId}' não encontrado.`);
            }
            yield exports.execOpenClawCommand('config', ['set', `agents.list.${agentIndex}.model`, identity.model]);
        }
        // Atualiza workspace via config (agents.list[<index>].workspace)
        if (identity.workspace !== undefined) {
            const agentsResult = yield exports.execOpenClawCommand('agents', ['list', '--json']);
            const output = typeof agentsResult === 'object' ? agentsResult : (agentsResult.stdout || '');
            const agents = output;
            const agentIndex = agents.findIndex(agent => agent.id === agentId);
            if (agentIndex === -1) {
                throw new Error(`Agente '${agentId}' não encontrado.`);
            }
            yield exports.execOpenClawCommand('config', ['set', `agents.list.${agentIndex}.workspace`, identity.workspace]);
        }
        // Invalida o cache para forçar atualização na próxima requisição
        agentCache.invalidate();
        // Aguarda um momento para garantir que OpenClaw processou o comando
        yield new Promise(resolve => setTimeout(resolve, 100));
        // Força recarga imediata do cache
        yield agentCache.getAgents(() => exports._fetchAgentsDirectly());
        return { success: true, agentId };
    }
    catch (error) {
        console.error('❌ agentService: Erro ao atualizar identidade do agente:', error.message);
        throw error;
    }
});
/**
 * Adiciona um binding a um agente
 * @param {string} agentId - ID do agente
 * @param {string} binding - Binding no formato canal:conta
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.bindAgent = (agentId, binding) => __awaiter(this, void 0, void 0, function* () {
    try {
        const result = yield exports.execOpenClawCommand('agents', [
            'bind',
            '--agent', agentId,
            '--bind', binding
        ]);
        // Invalida o cache para forçar atualização na próxima requisição
        agentCache.invalidate();
        return result;
    }
    catch (error) {
        console.error('Erro ao adicionar binding:', error.message);
        throw error;
    }
});
/**
 * Remove um binding de um agente
 * @param {string} agentId - ID do agente
 * @param {string} binding - Binding no formato canal:conta
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.unbindAgent = (agentId, binding) => __awaiter(this, void 0, void 0, function* () {
    try {
        const result = yield exports.execOpenClawCommand('agents', [
            'unbind',
            '--agent', agentId,
            '--bind', binding
        ]);
        // Invalida o cache para forçar atualização na próxima requisição
        agentCache.invalidate();
        return result;
    }
    catch (error) {
        console.error('Erro ao remover binding:', error.message);
        throw error;
    }
});
/**
 * Exclui um agente
 * @param {string} agentId - ID do agente
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.deleteAgent = (agentId) => __awaiter(this, void 0, void 0, function* () {
    try {
        // Adiciona --force para sessões não-interativas
        const result = yield exports.execOpenClawCommand('agents', ['delete', agentId, '--force']);
        // Invalida o cache para forçar atualização na próxima requisição
        agentCache.invalidate();
        return result;
    }
    catch (error) {
        console.error('Erro ao excluir agente:', error.message);
        throw error;
    }
});
/**
 * Obtém informações detalhadas de um agente
 * @param {string} agentId - ID do agente
 * @returns {Promise<Object>} - Informações do agente
 */
exports.getAgentDetails = (agentId) => __awaiter(this, void 0, void 0, function* () {
    try {
        // Primeiro listamos todos os agentes
        const agents = yield exports.listAgents();
        const agent = agents.find(a => a.id === agentId);
        if (!agent) {
            throw new Error(`Agente com ID ${agentId} não encontrado`);
        }
        return agent;
    }
    catch (error) {
        console.error('Erro ao obter detalhes do agente:', error.message);
        throw error;
    }
});
/**
 * Valida se um agente existe
 * @param {string} agentId - ID do agente
 * @returns {Promise<boolean>} - True se o agente existe
 */
exports.agentExists = (agentId) => __awaiter(this, void 0, void 0, function* () {
    try {
        const agents = yield exports.listAgents();
        return agents.some(a => a.id === agentId);
    }
    catch (error) {
        console.error('Erro ao verificar existência do agente:', error.message);
        return false;
    }
});
/**
 * Lê um arquivo do workspace do agente
 * @param {string} agentId - ID do agente
 * @param {string} filename - Nome do arquivo (IDENTITY.md ou SOUL.md)
 * @returns {Promise<string>} - Conteúdo do arquivo
 */
exports.readAgentFile = (agentId, filename) => __awaiter(this, void 0, void 0, function* () {
    try {
        // Primeiro verificar se o agente existe
        const exists = yield exports.agentExists(agentId);
        if (!exists) {
            throw new Error(`Agente com ID ${agentId} não encontrado`);
        }
        // Obter detalhes do agente para pegar o workspace
        const agentDetails = yield exports.getAgentDetails(agentId);
        const workspace = agentDetails.workspace;
        if (!workspace) {
            throw new Error(`Agente ${agentId} não tem workspace configurado`);
        }
        // Construir caminho completo do arquivo
        const filePath = path.join(workspace, filename);
        // Verificar se o arquivo existe
        try {
            yield fs.access(filePath);
        }
        catch (accessError) {
            // Arquivo não existe, retornar string vazia
            return '';
        }
        // Ler o conteúdo do arquivo
        const content = yield fs.readFile(filePath, 'utf8');
        return content;
    }
    catch (error) {
        console.error(`Erro ao ler arquivo ${filename} do agente ${agentId}:`, error.message);
        // Se o arquivo não existir, retornar string vazia (não é erro)
        if (error.code === 'ENOENT' || error.message.includes('ENOENT')) {
            return '';
        }
        throw error;
    }
});
/**
 * Escreve em um arquivo do workspace do agente
 * @param {string} agentId - ID do agente
 * @param {string} filename - Nome do arquivo (IDENTITY.md ou SOUL.md)
 * @param {string} content - Conteúdo a ser escrito
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.writeAgentFile = (agentId, filename, content) => __awaiter(this, void 0, void 0, function* () {
    try {
        // Primeiro verificar se o agente existe
        const exists = yield exports.agentExists(agentId);
        if (!exists) {
            throw new Error(`Agente com ID ${agentId} não encontrado`);
        }
        // Obter detalhes do agente para pegar o workspace
        const agentDetails = yield exports.getAgentDetails(agentId);
        const workspace = agentDetails.workspace;
        if (!workspace) {
            throw new Error(`Agente ${agentId} não tem workspace configurado`);
        }
        // Construir caminho completo do arquivo
        const filePath = path.join(workspace, filename);
        // Garantir que o diretório existe
        yield fs.mkdir(path.dirname(filePath), { recursive: true });
        // Escrever o conteúdo no arquivo
        yield fs.writeFile(filePath, content, 'utf8');
        return {
            success: true,
            message: `Arquivo ${filename} atualizado com sucesso no workspace do agente`,
            filePath,
            agentId,
            workspace
        };
    }
    catch (error) {
        console.error(`Erro ao escrever no arquivo ${filename} do agente ${agentId}:`, error.message);
        throw error;
    }
});
