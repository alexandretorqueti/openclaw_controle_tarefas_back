// src/controllers/authController.ts

/**
 * Controller de Autenticação Simplificado
 * * Sistema simplificado para uso local. Login apenas com nickname,
 * sem senha ou tokens.
 */

import { Request, Response, NextFunction } from 'express';
// CORREÇÃO: Importar a classe ErrorMiddleware, não os destruturados que não são usados
import { ErrorMiddleware } from '../middlewares/errorMiddleware';
import prisma from '../services/prismaService';
import { getAbsoluteAvatarUrl } from '../utils/avatarUrl';

// Expande a interface do Request para aceitar o correlationId (se já não estiver num arquivo global.d.ts)
declare module 'express' {
  interface Request {
    correlationId?: string;
  }
}

class AuthController {
  /**
   * Login simples por nickname
   * POST /api/auth/login
   * Body: { nickname: string }
   */
  login = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { nickname } = req.body;

    if (!nickname) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Nickname é obrigatório'
      });
      return;
    }

    // Buscar usuário pelo nickname
    const user = await prisma.user.findUnique({
      where: { nickname: (typeof nickname === 'string' ? nickname : String(nickname)).trim() },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Usuário não encontrado com este nickname'
      });
      return;
    }

    console.log(`✅ Login simplificado: ${user.nickname} (${user.name})`);
    
    // Convert relative avatar URL to absolute URL
    const userWithAbsoluteUrl = {
      ...user,
      avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl)
    };
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      user: userWithAbsoluteUrl,
      correlationId: req.correlationId
    });
  });

  /**
   * Obter usuário atual (por header ou query)
   * GET /api/auth/me
   * Header: X-User-Nickname ou Query: ?nickname=xxx
   */
  getCurrentUser = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Tratamento para garantir que pegamos a string caso venha como array nos headers
    const headerNickname = req.headers['x-user-nickname'];
    const queryNickname = req.query?.nickname;
    
    const nickname = (Array.isArray(headerNickname) ? headerNickname[0] : headerNickname) 
                  || (Array.isArray(queryNickname) ? queryNickname[0] : queryNickname as string);

    if (!nickname) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Nickname é obrigatório (header X-User-Nickname ou query ?nickname=xxx)'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { nickname: (typeof nickname === 'string' ? nickname : String(nickname)).trim() },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        user: null,
        message: 'Usuário não encontrado'
      });
      return;
    }

    // Convert relative avatar URL to absolute URL
    const userWithAbsoluteUrl = {
      ...user,
      avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl)
    };
    
    res.json({
      success: true,
      user: userWithAbsoluteUrl,
      correlationId: req.correlationId
    });
  });

  /**
   * Logout simplificado (apenas resposta de sucesso)
   * POST /api/auth/logout
   */
  logout = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.json({
      success: true,
      message: 'Logout realizado com sucesso',
      correlationId: req.correlationId
    });
  });

  /**
   * Verificar status de autenticação
   * GET /api/auth/check
   * POST /api/auth/check
   */
  checkAuth = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const headerNickname = req.headers['x-user-nickname'];
    
    const nickname = 
      (Array.isArray(headerNickname) ? headerNickname[0] : headerNickname) || 
      req.body?.nickname ||
      (typeof req.query?.nickname === 'string' ? req.query.nickname : undefined);
    
    const userId = req.body?.userId;

    // Se userId foi passado, buscar por ID
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          nickname: true,
          email: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Convert relative avatar URL to absolute URL if user exists
      const userWithAbsoluteUrl = user ? {
        ...user,
        avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl)
      } : null;
      
      res.json({
        isAuthenticated: !!user,
        user: userWithAbsoluteUrl,
        correlationId: req.correlationId
      });
      return;
    }

    // Se nickname foi passado, buscar por nickname
    if (nickname) {
      const user = await prisma.user.findUnique({
        where: { nickname: nickname.trim() },
        select: {
          id: true,
          name: true,
          nickname: true,
          email: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Convert relative avatar URL to absolute URL if user exists
      const userWithAbsoluteUrl = user ? {
        ...user,
        avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl)
      } : null;
      
      res.json({
        isAuthenticated: !!user,
        user: userWithAbsoluteUrl,
        correlationId: req.correlationId
      });
      return;
    }

    // Nenhum identificador fornecido
    res.json({
      isAuthenticated: false,
      user: null,
      message: 'Nenhum identificador de usuário fornecido',
      correlationId: req.correlationId
    });
  });

  /**
   * Callback OAuth removido - mantido para compatibilidade
   */
  googleAuthCallback = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.status(410).json({
      success: false,
      message: 'OAuth Google foi removido. Use login por nickname.',
      correlationId: req.correlationId
    });
  });
}

export default new AuthController();