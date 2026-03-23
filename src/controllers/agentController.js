var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const agentService = require('../services/agentService');
const agentCache = require('../services/agentCache');
/**
 * Lista todos os agentes
 * @route GET /api/agents
 */
exports.listAgents = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const agents = yield agentService.listAgents();
        // Ordenar agentes por nome de forma segura
        agents.sort((a, b) => {
            var _a, _b;
            const nameA = ((_a = a.identity) === null || _a === void 0 ? void 0 : _a.name) || a.name || a.id || '';
            const nameB = ((_b = b.identity) === null || _b === void 0 ? void 0 : _b.name) || b.name || b.id || '';
            return nameA.localeCompare(nameB);
        });
        res.json({
            success: true,
            data: agents,
            count: agents.length
        });
    }
    catch (error) {
        console.error('Erro no controller listAgents:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr || null
        });
    }
});
/**
 * Cria um novo agente
 * @route POST /api/agents
 */
exports.createAgent = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { name, workspace } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'O nome do agente é obrigatório'
            });
        }
        const agent = yield agentService.addAgent(name, workspace);
        res.status(201).json({
            success: true,
            data: agent,
            message: 'Agente criado com sucesso'
        });
    }
    catch (error) {
        console.error('Erro no controller createAgent:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr || null
        });
    }
});
/**
 * Obtém detalhes de um agente específico
 * @route GET /api/agents/:id
 */
exports.getAgent = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const agent = yield agentService.getAgentDetails(id);
        res.json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        console.error('Erro no controller getAgent:', error.message);
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr || null
        });
    }
});
/**
 * Atualiza a identidade de um agente
 * @route PUT /api/agents/:id/identity
 */
exports.updateAgentIdentity = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, emoji, avatar, model, workspace } = req.body;
        // Check if at least one field is provided (undefined means field not sent)
        const hasName = name !== undefined;
        const hasEmoji = emoji !== undefined;
        const hasAvatar = avatar !== undefined;
        const hasModel = model !== undefined;
        const hasWorkspace = workspace !== undefined;
        if (!hasName && !hasEmoji && !hasAvatar && !hasModel && !hasWorkspace) {
            return res.status(400).json({
                success: false,
                error: 'Pelo menos um campo (name, emoji, avatar, model ou workspace) deve ser fornecido'
            });
        }
        // Name cannot be empty string if provided
        if (hasName && name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'O nome não pode ser vazio'
            });
        }
        const identity = { name, emoji, avatar, model, workspace };
        const result = yield agentService.setAgentIdentity(id, identity);
        res.json({
            success: true,
            data: result,
            message: 'Identidade do agente atualizada com sucesso'
        });
    }
    catch (error) {
        console.error('Erro no controller updateAgentIdentity:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr || null
        });
    }
});
/**
 * Adiciona um binding a um agente
 * @route POST /api/agents/:id/bindings
 */
exports.addBinding = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { binding } = req.body;
        if (!binding) {
            return res.status(400).json({
                success: false,
                error: 'O binding é obrigatório (formato: canal:conta)'
            });
        }
        const result = yield agentService.bindAgent(id, binding);
        res.status(201).json({
            success: true,
            data: result,
            message: 'Binding adicionado com sucesso'
        });
    }
    catch (error) {
        console.error('Erro no controller addBinding:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr || null
        });
    }
});
/**
 * Remove um binding de um agente
 * @route DELETE /api/agents/:id/bindings
 */
exports.removeBinding = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { binding } = req.body;
        if (!binding) {
            return res.status(400).json({
                success: false,
                error: 'O binding é obrigatório (formato: canal:conta)'
            });
        }
        const result = yield agentService.unbindAgent(id, binding);
        res.json({
            success: true,
            data: result,
            message: 'Binding removido com sucesso'
        });
    }
    catch (error) {
        console.error('Erro no controller removeBinding:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr || null
        });
    }
});
/**
 * Exclui um agente
 * @route DELETE /api/agents/:id
 */
exports.deleteAgent = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const result = yield agentService.deleteAgent(id);
        res.json({
            success: true,
            data: result,
            message: 'Agente excluído com sucesso'
        });
    }
    catch (error) {
        console.error('Erro no controller deleteAgent:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr || null
        });
    }
});
/**
 * Obtém informações do cache de agentes
 * @route GET /api/agents/cache/info
 */
exports.getCacheInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const cacheInfo = agentCache.getCacheInfo();
        res.json({
            success: true,
            data: cacheInfo,
            message: 'Informações do cache obtidas com sucesso'
        });
    }
    catch (error) {
        console.error('Erro no controller getCacheInfo:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Invalida o cache de agentes (força atualização)
 * @route POST /api/agents/cache/invalidate
 */
exports.invalidateCache = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        agentCache.invalidate();
        res.json({
            success: true,
            message: 'Cache invalidado com sucesso. Próxima requisição buscará dados frescos.'
        });
    }
    catch (error) {
        console.error('Erro no controller invalidateCache:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Lê um arquivo do workspace do agente usando openclaw
 * @route GET /api/agents/:id/files/:filename
 */
exports.readAgentFile = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { id, filename } = req.params;
        // Validar nome do arquivo
        const validFiles = ['IDENTITY.md', 'SOUL.md'];
        if (!validFiles.includes(filename)) {
            return res.status(400).json({
                success: false,
                error: `Arquivo inválido. Apenas ${validFiles.join(', ')} são permitidos.`
            });
        }
        // Executar comando openclaw para ler o arquivo do workspace do agente
        const content = yield agentService.readAgentFile(id, filename);
        res.json({
            success: true,
            data: content,
            message: `Arquivo ${filename} lido com sucesso do workspace do agente`
        });
    }
    catch (error) {
        console.error('Erro no controller readAgentFile:', error.message);
        if (error.message.includes('não encontrado') || error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
        // Se o arquivo não existir, retornar vazio (não é erro)
        if (error.message.includes('No such file') || error.message.includes('ENOENT')) {
            return res.json({
                success: true,
                data: '',
                message: `Arquivo ${filename} não existe no workspace do agente`
            });
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Escreve em um arquivo do workspace do agente usando openclaw
 * @route PUT /api/agents/:id/files/:filename
 */
exports.writeAgentFile = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { id, filename } = req.params;
        const { content } = req.body;
        if (content === undefined || content === null) {
            return res.status(400).json({
                success: false,
                error: 'O conteúdo do arquivo é obrigatório'
            });
        }
        // Validar nome do arquivo
        const validFiles = ['IDENTITY.md', 'SOUL.md'];
        if (!validFiles.includes(filename)) {
            return res.status(400).json({
                success: false,
                error: `Arquivo inválido. Apenas ${validFiles.join(', ')} são permitidos.`
            });
        }
        // Executar comando openclaw para escrever no arquivo do workspace do agente
        const result = yield agentService.writeAgentFile(id, filename, String(content));
        res.json({
            success: true,
            data: result,
            message: `Arquivo ${filename} atualizado com sucesso no workspace do agente`
        });
    }
    catch (error) {
        console.error('Erro no controller writeAgentFile:', error.message);
        if (error.message.includes('não encontrado') || error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
