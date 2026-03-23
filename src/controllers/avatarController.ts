// src/controllers/avatarController.ts
import { Request, Response } from 'express';
import * as fs from 'fs'; // Import movido para o topo
import { AvatarService } from '../services/avatarService';

// Extensão rápida para suportar o Multer no req
interface MulterRequest extends Request {
  file?: any;
}

class AvatarController {
  /**
   * Upload de avatar para agente
   * @route POST /api/agents/:id/avatar
   */
  static async uploadAgentAvatar(req: MulterRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'Nenhum arquivo enviado'
        });
        return;
      }
      
      // Fazer upload via AvatarService
      const result = await AvatarService.uploadAvatar(id, req.file);
      
      res.json(result);
      
    } catch (error: any) {
      console.error('Erro no controller uploadAgentAvatar:', error);
      
      // Limpar arquivo temporário de forma segura
      if (req.file && req.file.path) {
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
  static async deleteAgentAvatar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const deleted = await AvatarService.deleteAvatar(id);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Avatar não encontrado para este agente'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Avatar removido com sucesso'
      });
      
    } catch (error: any) {
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
  static async getAgentAvatar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const avatar = await AvatarService.getAvatar(id);
      
      if (!avatar) {
        res.status(404).json({
          success: false,
          error: 'Avatar não encontrado para este agente'
        });
        return;
      }
      
      res.json({
        success: true,
        data: avatar
      });
      
    } catch (error: any) {
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
  static async serveAvatarFile(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, __filename } = req.params;
      
      const fileInfo = await AvatarService.serveAvatarFile(agentId, __filename);
      
      // Configurar headers
      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Length', fileInfo.size);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 dia
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.__filename}"`);
      
      // Enviar arquivo
      res.send(fileInfo.buffer);
      
    } catch (error: any) {
      console.error('Erro no controller serveAvatarFile:', error);
      
      if (error.message.includes('não encontrado')) {
        res.status(404).json({
          success: false,
          error: 'Arquivo de avatar não encontrado'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Erro ao servir arquivo de avatar'
      });
    }
  }
}

export default AvatarController;