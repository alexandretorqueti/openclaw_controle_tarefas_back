const agentService = require('../services/agentService');
const agentCache = require('../services/agentCache');

/**
 * Lista todos os agentes
 * @route GET /api/agents
 */
exports.listAgents = async (req, res) => {
  try {
    const agents = await agentService.listAgents();
    res.json({
      success: true,
      data: agents,
      count: agents.length
    });
  } catch (error) {
    console.error('Erro no controller listAgents:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr || null
    });
  }
};

/**
 * Cria um novo agente
 * @route POST /api/agents
 */
exports.createAgent = async (req, res) => {
  try {
    const { name, workspace } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'O nome do agente é obrigatório'
      });
    }
    
    const agent = await agentService.addAgent(name, workspace);
    
    res.status(201).json({
      success: true,
      data: agent,
      message: 'Agente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro no controller createAgent:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr || null
    });
  }
};

/**
 * Obtém detalhes de um agente específico
 * @route GET /api/agents/:id
 */
exports.getAgent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const agent = await agentService.getAgentDetails(id);
    
    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
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
};

/**
 * Atualiza a identidade de um agente
 * @route PUT /api/agents/:id/identity
 */
exports.updateAgentIdentity = async (req, res) => {
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
    const result = await agentService.setAgentIdentity(id, identity);
    
    res.json({
      success: true,
      data: result,
      message: 'Identidade do agente atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro no controller updateAgentIdentity:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr || null
    });
  }
};

/**
 * Adiciona um binding a um agente
 * @route POST /api/agents/:id/bindings
 */
exports.addBinding = async (req, res) => {
  try {
    const { id } = req.params;
    const { binding } = req.body;
    
    if (!binding) {
      return res.status(400).json({
        success: false,
        error: 'O binding é obrigatório (formato: canal:conta)'
      });
    }
    
    const result = await agentService.bindAgent(id, binding);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Binding adicionado com sucesso'
    });
  } catch (error) {
    console.error('Erro no controller addBinding:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr || null
    });
  }
};

/**
 * Remove um binding de um agente
 * @route DELETE /api/agents/:id/bindings
 */
exports.removeBinding = async (req, res) => {
  try {
    const { id } = req.params;
    const { binding } = req.body;
    
    if (!binding) {
      return res.status(400).json({
        success: false,
        error: 'O binding é obrigatório (formato: canal:conta)'
      });
    }
    
    const result = await agentService.unbindAgent(id, binding);
    
    res.json({
      success: true,
      data: result,
      message: 'Binding removido com sucesso'
    });
  } catch (error) {
    console.error('Erro no controller removeBinding:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr || null
    });
  }
};

/**
 * Exclui um agente
 * @route DELETE /api/agents/:id
 */
exports.deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await agentService.deleteAgent(id);
    
    res.json({
      success: true,
      data: result,
      message: 'Agente excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro no controller deleteAgent:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr || null
    });
  }
};

/**
 * Obtém informações do cache de agentes
 * @route GET /api/agents/cache/info
 */
exports.getCacheInfo = async (req, res) => {
  try {
    const cacheInfo = agentCache.getCacheInfo();
    
    res.json({
      success: true,
      data: cacheInfo,
      message: 'Informações do cache obtidas com sucesso'
    });
  } catch (error) {
    console.error('Erro no controller getCacheInfo:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Invalida o cache de agentes (força atualização)
 * @route POST /api/agents/cache/invalidate
 */
exports.invalidateCache = async (req, res) => {
  try {
    agentCache.invalidate();
    
    res.json({
      success: true,
      message: 'Cache invalidado com sucesso. Próxima requisição buscará dados frescos.'
    });
  } catch (error) {
    console.error('Erro no controller invalidateCache:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};