// Migrado para TypeScript - Fase: Controllers
// Arquivo: agentController.js

import agentService from '../services/agentService';
import agentCache from '../services/agentCache';

/**
 * Lista todos os agentes
 * @route GET /api/agents
 */
export const listAgents = async (req, res): Promise<any> => {
  try {
    const agents = await agentService.listAgents();
    
    // Ordenar agentes por nome de forma segura
    agents.sort((a, b) => {
      const nameA = a.identity?.name || a.name || a.id || '';
      const nameB = b.identity?.name || b.name || b.id || '';
      return nameA.localeCompare(nameB);
    });
    
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
export const createAgent = async (req, res): Promise<any> => {
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
export const getAgent = async (req, res): Promise<any> => {
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
export const updateAgentIdentity = async (req, res): Promise<any> => {
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
export const addBinding = async (req, res): Promise<any> => {
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
export const removeBinding = async (req, res): Promise<any> => {
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
export const deleteAgent = async (req, res): Promise<any> => {
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
export const getCacheInfo = async (req, res): Promise<any> => {
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
export const invalidateCache = async (req, res): Promise<any> => {
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

/**
 * Lê um arquivo do workspace do agente usando openclaw
 * @route GET /api/agents/:id/files/:__filename
 */
export const readAgentFile = async (req, res): Promise<any> => {
  try {
    const { id, __filename } = req.params;
    
    // Validar nome do arquivo
    const validFiles = ['IDENTITY.md', 'SOUL.md'];
    if (!validFiles.includes(__filename)) {
      return res.status(400).json({
        success: false,
        error: `Arquivo inválido. Apenas ${validFiles.join(', ')} são permitidos.`
      });
    }
    
    // Executar comando openclaw para ler o arquivo do workspace do agente
    const content = await agentService.readAgentFile(id, __filename);
    
    res.json({
      success: true,
      data: content,
      message: `Arquivo ${__filename} lido com sucesso do workspace do agente`
    });
  } catch (error) {
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
        message: `Arquivo ${__filename} não existe no workspace do agente`
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Escreve em um arquivo do workspace do agente usando openclaw
 * @route PUT /api/agents/:id/files/:__filename
 */
export const writeAgentFile = async (req, res): Promise<any> => {
  try {
    const { id, __filename } = req.params;
    const { content } = req.body;
    
    if (content === undefined || content === null) {
      return res.status(400).json({
        success: false,
        error: 'O conteúdo do arquivo é obrigatório'
      });
    }
    
    // Validar nome do arquivo
    const validFiles = ['IDENTITY.md', 'SOUL.md'];
    if (!validFiles.includes(__filename)) {
      return res.status(400).json({
        success: false,
        error: `Arquivo inválido. Apenas ${validFiles.join(', ')} são permitidos.`
      });
    }
    
    // Executar comando openclaw para escrever no arquivo do workspace do agente
    const result = await agentService.writeAgentFile(id, __filename, String(content));
    
    res.json({
      success: true,
      data: result,
      message: `Arquivo ${__filename} atualizado com sucesso no workspace do agente`
    });
  } catch (error) {
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
};