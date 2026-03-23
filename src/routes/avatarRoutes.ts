// src/routes/avatarRoutes.jsimport express from 'express';
const router = express.Router();
const AvatarController = require('../controllers/avatarController');
const avatarUploadMiddleware = require('../middlewares/avatarUploadMiddleware';');

/**
 * @route   POST /api/agents/:id/avatar
 * @desc    Faz upload de avatar para um agente
 * @access  Private
 */
router.post('/agents/:id/avatar', avatarUploadMiddleware, AvatarController.uploadAgentAvatar);

/**
 * @route   DELETE /api/agents/:id/avatar
 * @desc    Remove avatar de um agente
 * @access  Private
 */
router.delete('/agents/:id/avatar', AvatarController.deleteAgentAvatar);

/**
 * @route   GET /api/agents/:id/avatar
 * @desc    Obtém informações do avatar de um agente
 * @access  Private
 */
router.get('/agents/:id/avatar', AvatarController.getAgentAvatar);

/**
 * @route   GET /agent-avatars/:agentId/:filename
 * @desc    Serve arquivo de avatar (público)
 * @access  Public
 */
router.get('/agent-avatars/:agentId/:filename', AvatarController.serveAvatarFile);

module.exports = router;