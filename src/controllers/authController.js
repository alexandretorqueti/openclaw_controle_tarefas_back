/**
 * Controller de Autenticação Simplificado
 * 
 * Sistema simplificado para uso local. Login apenas com nickname,
 * sem senha ou tokens.
 */

const ErrorMiddleware = require('../middlewares/errorMiddleware');
const prisma = require('../services/prismaService');

class AuthController {
  /**
   * Login simples por nickname
   * POST /api/auth/login
   * Body: { nickname: string }
   */
  login = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { nickname } = req.body;

    if (!nickname) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Nickname é obrigatório'
      });
    }

    // Buscar usuário pelo nickname
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

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Usuário não encontrado com este nickname'
      });
    }

    console.log(`✅ Login simplificado: ${user.nickname} (${user.name})`);
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      user: user,
      correlationId: req.correlationId
    });
  });

  /**
   * Obter usuário atual (por header ou query)
   * GET /api/auth/me
   * Header: X-User-Nickname ou Query: ?nickname=xxx
   */
  getCurrentUser = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const nickname = req.headers['x-user-nickname'] || req.query?.nickname;

    if (!nickname) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Nickname é obrigatório (header X-User-Nickname ou query ?nickname=xxx)'
      });
    }

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

    if (!user) {
      return res.status(404).json({
        success: false,
        user: null,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      user: user,
      correlationId: req.correlationId
    });
  });

  /**
   * Logout simplificado (apenas resposta de sucesso)
   * POST /api/auth/logout
   */
  logout = ErrorMiddleware.catchAsync(async (req, res, next) => {
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
  checkAuth = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const nickname = 
      req.headers['x-user-nickname'] || 
      req.body?.nickname ||
      req.query?.nickname;
    
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

      return res.json({
        isAuthenticated: !!user,
        user: user || null,
        correlationId: req.correlationId
      });
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

      return res.json({
        isAuthenticated: !!user,
        user: user || null,
        correlationId: req.correlationId
      });
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
  googleAuthCallback = ErrorMiddleware.catchAsync(async (req, res, next) => {
    res.status(410).json({
      success: false,
      message: 'OAuth Google foi removido. Use login por nickname.',
      correlationId: req.correlationId
    });
  });
}

module.exports = new AuthController();
