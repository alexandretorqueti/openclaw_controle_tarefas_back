var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// src/utils/userResolver.js
const prisma = require('../services/prismaService');
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
    static resolveUser({ nickname, userId, defaultNickname = null }) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Primeiro, tentar por ID se fornecido
                if (userId) {
                    const userById = yield prisma.user.findUnique({
                        where: { id: userId },
                        select: { id: true, name: true, nickname: true, email: true, role: true }
                    });
                    if (userById)
                        return userById;
                }
                // Tentar por nickname se fornecido
                if (nickname) {
                    const userByNickname = yield prisma.user.findUnique({
                        where: { nickname: nickname.trim() },
                        select: { id: true, name: true, nickname: true, email: true, role: true }
                    });
                    if (userByNickname)
                        return userByNickname;
                }
                // Se temos um apelido padrão, tentar por ele
                if (defaultNickname) {
                    const userByDefault = yield prisma.user.findUnique({
                        where: { nickname: defaultNickname.trim() },
                        select: { id: true, name: true, nickname: true, email: true, role: true }
                    });
                    if (userByDefault)
                        return userByDefault;
                }
                // Tentar apelidos padrão do sistema (alexandre e jarbas)
                const defaultNicknames = ['alexandre', process.env.MY_USER_NICKNAME || 'jarbas'];
                for (const defaultNick of defaultNicknames) {
                    const user = yield prisma.user.findUnique({
                        where: { nickname: defaultNick },
                        select: { id: true, name: true, nickname: true, email: true, role: true }
                    });
                    if (user)
                        return user;
                }
                // Último recurso: buscar o primeiro usuário do sistema
                const firstUser = yield prisma.user.findFirst({
                    select: { id: true, name: true, nickname: true, email: true, role: true }
                });
                if (firstUser) {
                    console.log(`Usando primeiro usuário do sistema como fallback: ${firstUser.nickname} (${firstUser.id})`);
                    return firstUser;
                }
                return null;
            }
            catch (error) {
                console.error('Erro ao resolver usuário:', error.message);
                return null;
            }
        });
    }
    /**
     * Resolve usuário a partir de uma requisição HTTP
     * Extrai informações de headers, body e query parameters
     * @param {Object} req - Objeto de requisição Express
     * @returns {Promise<Object|null>} Usuário encontrado ou null
     */
    static resolveUserFromRequest(req) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __awaiter(this, void 0, void 0, function* () {
            // Extrair informações da requisição
            const nickname = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.nickname) ||
                ((_b = req.body) === null || _b === void 0 ? void 0 : _b.userNickname) ||
                ((_c = req.body) === null || _c === void 0 ? void 0 : _c.createdByNickname) ||
                ((_e = (_d = req.body) === null || _d === void 0 ? void 0 : _d.created_by) === null || _e === void 0 ? void 0 : _e.nickname) ||
                ((_f = req.query) === null || _f === void 0 ? void 0 : _f.nickname) ||
                req.headers['x-user-nickname'];
            const userId = ((_g = req.body) === null || _g === void 0 ? void 0 : _g.userId) ||
                ((_h = req.body) === null || _h === void 0 ? void 0 : _h.createdById) ||
                ((_k = (_j = req.body) === null || _j === void 0 ? void 0 : _j.created_by) === null || _k === void 0 ? void 0 : _k.id) ||
                ((_l = req.query) === null || _l === void 0 ? void 0 : _l.userId) ||
                req.headers['x-user-id'];
            // Extrair apelido padrão do environment
            const defaultNickname = process.env.DEV_NICKNAME || process.env.MY_USER_NICKNAME;
            return yield this.resolveUser({
                nickname,
                userId,
                defaultNickname
            });
        });
    }
    /**
     * Obtém o ID do usuário padrão do sistema (alexandre ou jarbas)
     * @returns {Promise<string|null>} ID do usuário padrão ou null
     */
    static getDefaultUserId() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Tentar apelidos padrão na ordem: alexandre, jarbas
                const defaultNicknames = ['alexandre', 'jarbas'];
                for (const nickname of defaultNicknames) {
                    const user = yield prisma.user.findUnique({
                        where: { nickname },
                        select: { id: true }
                    });
                    if (user)
                        return user.id;
                }
                // Último recurso: primeiro usuário
                const firstUser = yield prisma.user.findFirst({
                    select: { id: true }
                });
                return firstUser ? firstUser.id : null;
            }
            catch (error) {
                console.error('Erro ao obter ID do usuário padrão:', error.message);
                return null;
            }
        });
    }
}
module.exports = UserResolver;
