// src/utils/userResolver.js
const _prisma = require('../services/prismaService');
const prisma = _prisma.default || _prisma;

/**
 * Helper para resolver usuários por apelido (nickname) ou ID
 * Suporta múltiplos apelidos padrão configurados via environment variables
 */
class UserResolver {
  /**
   * Resolve um usuário a partir de nickname, ID ou apelidos padrão
   * @param {Object} options - Opções de resolução
   * @param {string} [options.nickname] - Nickname do usuário
   * @param {string} [options.userId] - ID do usuário
   * @param {string} [options.defaultNickname] - Apelido padrão para fallback
   * @returns {Promise<Object|null>} Usuário encontrado ou null
   */
  static async resolveUser({ nickname, userId, defaultNickname = null }) {
    try {
      // Primeiro, tentar por ID se fornecido
      if (userId) {
        const userById = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, nickname: true, email: true, role: true }
        });
        if (userById) return userById;
      }

      // Tentar por nickname se fornecido
      if (nickname) {
        const userByNickname = await prisma.user.findUnique({
          where: { nickname: nickname.trim() },
          select: { id: true, name: true, nickname: true, email: true, role: true }
        });
        if (userByNickname) return userByNickname;
      }

      // Se temos um apelido padrão, tentar por ele
      if (defaultNickname) {
        const userByDefault = await prisma.user.findUnique({
          where: { nickname: defaultNickname.trim() },
          select: { id: true, name: true, nickname: true, email: true, role: true }
        });
        if (userByDefault) return userByDefault;
      }

      // Tentar apelidos padrão do sistema (alexandre e jarbas)
      const defaultNicknames = ['alexandre', process.env.MY_USER_NICKNAME || 'jarbas'];
      for (const defaultNick of defaultNicknames) {
        const user = await prisma.user.findUnique({
          where: { nickname: defaultNick },
          select: { id: true, name: true, nickname: true, email: true, role: true }
        });
        if (user) return user;
      }

      // Último recurso: buscar o primeiro usuário do sistema
      const firstUser = await prisma.user.findFirst({
        select: { id: true, name: true, nickname: true, email: true, role: true }
      });
      
      if (firstUser) {
        console.log(`Usando primeiro usuário do sistema como fallback: ${firstUser.nickname} (${firstUser.id})`);
        return firstUser;
      }

      return null;
    } catch (error) {
      console.error('Erro ao resolver usuário:', error.message);
      return null;
    }
  }

  /**
   * Resolve usuário a partir de uma requisição HTTP
   * Extrai informações de headers, body e query parameters
   * @param {Object} req - Objeto de requisição Express
   * @returns {Promise<Object|null>} Usuário encontrado ou null
   */
  static async resolveUserFromRequest(req) {
    // Extrair informações da requisição
    const nickname = req.body?.nickname || 
                    req.body?.userNickname || 
                    req.body?.createdByNickname ||
                    req.body?.created_by?.nickname ||
                    req.query?.nickname ||
                    req.headers['x-user-nickname'];

    const userId = req.body?.userId || 
                  req.body?.createdById || 
                  req.body?.created_by?.id ||
                  req.query?.userId ||
                  req.headers['x-user-id'];

    // Extrair apelido padrão do environment
    const defaultNickname = process.env.DEV_NICKNAME || process.env.MY_USER_NICKNAME;

    return await this.resolveUser({
      nickname,
      userId,
      defaultNickname
    });
  }

  /**
   * Obtém o ID do usuário padrão do sistema (alexandre ou jarbas)
   * @returns {Promise<string|null>} ID do usuário padrão ou null
   */
  static async getDefaultUserId() {
    try {
      // Tentar apelidos padrão na ordem: alexandre, jarbas
      const defaultNicknames = ['alexandre', 'jarbas'];
      
      for (const nickname of defaultNicknames) {
        const user = await prisma.user.findUnique({
          where: { nickname },
          select: { id: true }
        });
        if (user) return user.id;
      }

      // Último recurso: primeiro usuário
      const firstUser = await prisma.user.findFirst({
        select: { id: true }
      });
      
      return firstUser ? firstUser.id : null;
    } catch (error) {
      console.error('Erro ao obter ID do usuário padrão:', error.message);
      return null;
    }
  }
}

module.exports = UserResolver;