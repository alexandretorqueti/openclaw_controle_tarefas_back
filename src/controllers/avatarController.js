var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// src/controllers/avatarController.js
const AvatarService = require('../services/avatarService');
class AvatarController {
    /**
     * Upload de avatar para agente
     * @route POST /api/agents/:id/avatar
     */
    static uploadAgentAvatar(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nenhum arquivo enviado'
                    });
                }
                // Fazer upload via AvatarService
                const result = yield AvatarService.uploadAvatar(id, req.file);
                res.json(result);
            }
            catch (error) {
                console.error('Erro no controller uploadAgentAvatar:', error);
                // Limpar arquivo temporário
                if (req.file && req.file.path) {
                    const fs = require('fs');
                    fs.unlink(req.file.path, () => { });
                }
                res.status(500).json({
                    success: false,
                    error: error.message || 'Erro interno no servidor'
                });
            }
        });
    }
    /**
     * Remove avatar de agente
     * @route DELETE /api/agents/:id/avatar
     */
    static deleteAgentAvatar(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const deleted = yield AvatarService.deleteAvatar(id);
                if (!deleted) {
                    return res.status(404).json({
                        success: false,
                        error: 'Avatar não encontrado para este agente'
                    });
                }
                res.json({
                    success: true,
                    message: 'Avatar removido com sucesso'
                });
            }
            catch (error) {
                console.error('Erro no controller deleteAgentAvatar:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Erro interno no servidor'
                });
            }
        });
    }
    /**
     * Obtém informações do avatar de um agente
     * @route GET /api/agents/:id/avatar
     */
    static getAgentAvatar(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const avatar = yield AvatarService.getAvatar(id);
                if (!avatar) {
                    return res.status(404).json({
                        success: false,
                        error: 'Avatar não encontrado para este agente'
                    });
                }
                res.json({
                    success: true,
                    data: avatar
                });
            }
            catch (error) {
                console.error('Erro no controller getAgentAvatar:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Erro interno no servidor'
                });
            }
        });
    }
    /**
     * Serve arquivo de avatar
     * @route GET /agent-avatars/:agentId/:filename
     */
    static serveAvatarFile(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { agentId, filename } = req.params;
                const fileInfo = yield AvatarService.serveAvatarFile(agentId, filename);
                // Configurar headers
                res.setHeader('Content-Type', fileInfo.mimeType);
                res.setHeader('Content-Length', fileInfo.size);
                res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 dia
                res.setHeader('Content-Disposition', `inline; filename="${fileInfo.filename}"`);
                // Enviar arquivo
                res.send(fileInfo.buffer);
            }
            catch (error) {
                console.error('Erro no controller serveAvatarFile:', error);
                if (error.message.includes('não encontrado')) {
                    return res.status(404).json({
                        success: false,
                        error: 'Arquivo de avatar não encontrado'
                    });
                }
                res.status(500).json({
                    success: false,
                    error: 'Erro ao servir arquivo de avatar'
                });
            }
        });
    }
}
module.exports = AvatarController;
