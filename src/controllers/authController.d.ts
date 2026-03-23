/**
 * Controller de Autenticação Simplificado
 *
 * Sistema simplificado para uso local. Login apenas com nickname,
 * sem senha ou tokens.
 */
declare const ErrorMiddleware: any;
declare const prisma: any;
declare const getAbsoluteAvatarUrl: any;
declare class AuthController {
    /**
     * Login simples por nickname
     * POST /api/auth/login
     * Body: { nickname: string }
     */
    login: any;
    /**
     * Obter usuário atual (por header ou query)
     * GET /api/auth/me
     * Header: X-User-Nickname ou Query: ?nickname=xxx
     */
    getCurrentUser: any;
    /**
     * Logout simplificado (apenas resposta de sucesso)
     * POST /api/auth/logout
     */
    logout: any;
    /**
     * Verificar status de autenticação
     * GET /api/auth/check
     * POST /api/auth/check
     */
    checkAuth: any;
    /**
     * Callback OAuth removido - mantido para compatibilidade
     */
    googleAuthCallback: any;
}
