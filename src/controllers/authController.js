/**
 * Controller de Autenticação Simplificado
 *
 * Sistema simplificado para uso local. Login apenas com nickname,
 * sem senha ou tokens.
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
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const prisma = require('../services/prismaService');
const { getAbsoluteAvatarUrl } = require('../utils/avatarUrl');
class AuthController {
    constructor() {
        /**
         * Login simples por nickname
         * POST /api/auth/login
         * Body: { nickname: string }
         */
        this.login = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { nickname } = req.body;
            if (!nickname) {
                return res.status(400).json({
                    success: false,
                    error: 'Bad Request',
                    message: 'Nickname é obrigatório'
                });
            }
            // Buscar usuário pelo nickname
            const user = yield prisma.user.findUnique({
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
            // Convert relative avatar URL to absolute URL
            const userWithAbsoluteUrl = Object.assign(Object.assign({}, user), { avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl) });
            res.json({
                success: true,
                message: 'Login realizado com sucesso',
                user: userWithAbsoluteUrl,
                correlationId: req.correlationId
            });
        }));
        /**
         * Obter usuário atual (por header ou query)
         * GET /api/auth/me
         * Header: X-User-Nickname ou Query: ?nickname=xxx
         */
        this.getCurrentUser = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const nickname = req.headers['x-user-nickname'] || ((_a = req.query) === null || _a === void 0 ? void 0 : _a.nickname);
            if (!nickname) {
                return res.status(400).json({
                    success: false,
                    error: 'Bad Request',
                    message: 'Nickname é obrigatório (header X-User-Nickname ou query ?nickname=xxx)'
                });
            }
            const user = yield prisma.user.findUnique({
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
            // Convert relative avatar URL to absolute URL
            const userWithAbsoluteUrl = Object.assign(Object.assign({}, user), { avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl) });
            res.json({
                success: true,
                user: userWithAbsoluteUrl,
                correlationId: req.correlationId
            });
        }));
        /**
         * Logout simplificado (apenas resposta de sucesso)
         * POST /api/auth/logout
         */
        this.logout = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            res.json({
                success: true,
                message: 'Logout realizado com sucesso',
                correlationId: req.correlationId
            });
        }));
        /**
         * Verificar status de autenticação
         * GET /api/auth/check
         * POST /api/auth/check
         */
        this.checkAuth = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _b, _c, _d;
            const nickname = req.headers['x-user-nickname'] ||
                ((_b = req.body) === null || _b === void 0 ? void 0 : _b.nickname) ||
                ((_c = req.query) === null || _c === void 0 ? void 0 : _c.nickname);
            const userId = (_d = req.body) === null || _d === void 0 ? void 0 : _d.userId;
            // Se userId foi passado, buscar por ID
            if (userId) {
                const user = yield prisma.user.findUnique({
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
                const userWithAbsoluteUrl = user ? Object.assign(Object.assign({}, user), { avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl) }) : null;
                return res.json({
                    isAuthenticated: !!user,
                    user: userWithAbsoluteUrl,
                    correlationId: req.correlationId
                });
            }
            // Se nickname foi passado, buscar por nickname
            if (nickname) {
                const user = yield prisma.user.findUnique({
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
                const userWithAbsoluteUrl = user ? Object.assign(Object.assign({}, user), { avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl) }) : null;
                return res.json({
                    isAuthenticated: !!user,
                    user: userWithAbsoluteUrl,
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
        }));
        /**
         * Callback OAuth removido - mantido para compatibilidade
         */
        this.googleAuthCallback = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            res.status(410).json({
                success: false,
                message: 'OAuth Google foi removido. Use login por nickname.',
                correlationId: req.correlationId
            });
        }));
    }
}
module.exports = new AuthController();
