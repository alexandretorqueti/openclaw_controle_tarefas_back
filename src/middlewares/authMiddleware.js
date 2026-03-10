/**
 * Middleware de Autenticação Simplificado
 * 
 * Sistema simplificado para uso local onde não há necessidade de autenticação
 * completa. Apenas identifica o usuário pelo nickname quando necessário.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware que extrai o usuário do header ou body da requisição
 * Aceita:
 * - Header: X-User-Nickname
 * - Body: nickname, userNickname ou createdByNickname
 * - Query: nickname
 */
const extractUser = async (req, res, next) => {
  try {
    // Tentar obter nickname de várias fontes
    const nickname = 
      req.headers['x-user-nickname'] ||
      req.body?.nickname ||
      req.body?.userNickname ||
      req.body?.createdByNickname ||
      req.query?.nickname;

    if (nickname) {
      // Buscar usuário pelo nickname
      const user = await prisma.user.findUnique({
        where: { nickname },
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

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    console.error('Erro ao extrair usuário:', error);
    next();
  }
};

/**
 * Middleware legado - mantido para compatibilidade
 * Agora não faz verificação de autenticação
 */
const isAuthenticated = (req, res, next) => {
  // Sistema simplificado - sempre permite acesso
  next();
};

/**
 * Middleware legado - mantido para compatibilidade
 */
const getCurrentUser = (req, res, next) => {
  // Se não há usuário definido, deixa como null
  if (!req.user) {
    req.user = null;
  }
  next();
};

/**
 * Configuração de sessão vazia para compatibilidade
 */
const sessionConfig = {
  secret: 'not-used-simplified-auth',
  resave: false,
  saveUninitialized: false
};

/**
 * Objeto passport stub para compatibilidade
 */
const passport = {
  initialize: () => (req, res, next) => next(),
  session: () => (req, res, next) => next(),
  use: () => {},
  serializeUser: () => {},
  deserializeUser: () => {}
};

module.exports = {
  extractUser,
  isAuthenticated,
  getCurrentUser,
  sessionConfig,
  passport
};
