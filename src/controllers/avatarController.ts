// Migrado para TypeScript - Fase: Controllers
// Arquivo: avatarController.js

// src/controllers/avatarController.js
import AvatarService from '../services/avatarService';

class AvatarController {
  /**
   * Upload de avatar para agente
   * @route POST /api/agents/:id/avatar
   */
  static async uploadAgentAvatar(req, res): Promise<any> {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo enviado'
        });
      }
      
      // Fazer upload via AvatarService
      const result = await AvatarService.uploadAvatar(id, req.file);
      
      res.json(result);
      
    } catch (error) {
      console.error('Erro no controller uploadAgentAvatar:', error);
      
      // Limpar arquivo temporário
      if (req.file && req.file.path) {
        import * as fs from 'fs';
        fs.unlink(req.file.path, () => {});
      }
      
      res.status(500).json({
        success: false,
        error: error.message || 'Erro interno no servidor'
      });
    }
  }
  
  /**
   * Remove avatar de agente
   * @route DELETE /api/agents/:id/avatar
   */
  static async deleteAgentAvatar(req, res): Promise<any> {
    try {
      const { id } = req.params;
      
      const deleted = await AvatarService.deleteAvatar(id);
      
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
      
    } catch (error) {
      console.error('Erro no controller deleteAgentAvatar:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro interno no servidor'
      });
    }
  }
  
  /**
   * Obtém informações do avatar de um agente
   * @route GET /api/agents/:id/avatar
   */
  static async getAgentAvatar(req, res): Promise<any> {
    try {
      const { id } = req.params;
      
      const avatar = await AvatarService.getAvatar(id);
      
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
      
    } catch (error) {
      console.error('Erro no controller getAgentAvatar:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro interno no servidor'
      });
    }
  }
  
  /**
   * Serve arquivo de avatar
   * @route GET /agent-avatars/:agentId/:__filename
   */
  static async serveAvatarFile(req, res): Promise<any> {
    try {
      const { agentId, __filename } = req.params;
      
      const fileInfo = await AvatarService.serveAvatarFile(agentId, __filename);
      
      // Configurar headers
      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Length', fileInfo.size);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 dia
      res.setHeader('Content-Disposition', `inline; __filename="${fileInfo.__filename}"`);
      
      // Enviar arquivo
      res.send(fileInfo.buffer);
      
    } catch (error) {
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
  }
}

export default AvatarController;