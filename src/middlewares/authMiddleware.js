/**
 * Middleware de Autenticação Simplificado
 *
 * Sistema simplificado para uso local onde não há necessidade de autenticação
 * completa. Apenas identifica o usuário pelo nickname quando necessário.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
/**
 * Middleware que extrai o usuário do header ou body da requisição
 * Aceita:
 * - Header: X-User-Nickname
 * - Body: nickname, userNickname ou createdByNickname
 * - Query: nickname
 */
const extractUser = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        // Tentar obter nickname de várias fontes
        const nickname = req.headers['x-user-nickname'] ||
            ((_a = req.body) === null || _a === void 0 ? void 0 : _a.nickname) ||
            ((_b = req.body) === null || _b === void 0 ? void 0 : _b.userNickname) ||
            ((_c = req.body) === null || _c === void 0 ? void 0 : _c.createdByNickname) ||
            ((_d = req.query) === null || _d === void 0 ? void 0 : _d.nickname);
        if (nickname) {
            // Buscar usuário pelo nickname
            const user = yield prisma.user.findUnique({
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
    }
    catch (error) {
        console.error('Erro ao extrair usuário:', error);
        next();
    }
});
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
    use: () => { },
    serializeUser: () => { },
    deserializeUser: () => { },
    authenticate: () => (req, res, next) => next()
};
module.exports = {
    extractUser,
    isAuthenticated,
    getCurrentUser,
    sessionConfig,
    passport
};
