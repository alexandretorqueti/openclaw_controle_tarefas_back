const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
/**
 * @route   GET /api/agents
 * @desc    Lista todos os agentes
 * @access  Private
 */
router.get('/', agentController.listAgents);
/**
 * @route   POST /api/agents
 * @desc    Cria um novo agente
 * @access  Private
 */
router.post('/', agentController.createAgent);
/**
 * @route   GET /api/agents/:id
 * @desc    Obtém detalhes de um agente específico
 * @access  Private
 */
router.get('/:id', agentController.getAgent);
/**
 * @route   PUT /api/agents/:id/identity
 * @desc    Atualiza a identidade de um agente (nome, emoji, avatar)
 * @access  Private
 */
router.put('/:id/identity', agentController.updateAgentIdentity);
/**
 * @route   POST /api/agents/:id/bindings
 * @desc    Adiciona um binding a um agente
 * @access  Private
 */
router.post('/:id/bindings', agentController.addBinding);
/**
 * @route   DELETE /api/agents/:id/bindings
 * @desc    Remove um binding de um agente
 * @access  Private
 */
router.delete('/:id/bindings', agentController.removeBinding);
/**
 * @route   DELETE /api/agents/:id
 * @desc    Exclui um agente
 * @access  Private
 */
router.delete('/:id', agentController.deleteAgent);
/**
 * @route   GET /api/agents/cache/info
 * @desc    Obtém informações do cache de agentes
 * @access  Private
 */
router.get('/cache/info', agentController.getCacheInfo);
/**
 * @route   POST /api/agents/cache/invalidate
 * @desc    Invalida o cache de agentes (força atualização)
 * @access  Private
 */
router.post('/cache/invalidate', agentController.invalidateCache);
/**
 * @route   GET /api/agents/:id/files/:filename
 * @desc    Lê um arquivo do workspace do agente (IDENTITY.md ou SOUL.md)
 * @access  Private
 */
router.get('/:id/files/:filename', agentController.readAgentFile);
/**
 * @route   PUT /api/agents/:id/files/:filename
 * @desc    Escreve em um arquivo do workspace do agente (IDENTITY.md ou SOUL.md)
 * @access  Private
 */
router.put('/:id/files/:filename', agentController.writeAgentFile);
// Avatar removido de agentRoutes - agora em avatarRoutes.js
// Avatar endpoints moved to avatarRoutes.js
module.exports = router;
