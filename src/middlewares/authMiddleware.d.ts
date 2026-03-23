/**
 * Middleware de Autenticação Simplificado
 *
 * Sistema simplificado para uso local onde não há necessidade de autenticação
 * completa. Apenas identifica o usuário pelo nickname quando necessário.
 */
declare const PrismaClient: any;
declare const prisma: any;
/**
 * Middleware que extrai o usuário do header ou body da requisição
 * Aceita:
 * - Header: X-User-Nickname
 * - Body: nickname, userNickname ou createdByNickname
 * - Query: nickname
 */
declare const extractUser: (req: any, res: any, next: any) => Promise<void>;
/**
 * Middleware legado - mantido para compatibilidade
 * Agora não faz verificação de autenticação
 */
declare const isAuthenticated: (req: any, res: any, next: any) => void;
/**
 * Middleware legado - mantido para compatibilidade
 */
declare const getCurrentUser: (req: any, res: any, next: any) => void;
/**
 * Configuração de sessão vazia para compatibilidade
 */
declare const sessionConfig: {
    secret: string;
    resave: boolean;
    saveUninitialized: boolean;
};
/**
 * Objeto passport stub para compatibilidade
 */
declare const passport: {
    initialize: () => (req: any, res: any, next: any) => any;
    session: () => (req: any, res: any, next: any) => any;
    use: () => void;
    serializeUser: () => void;
    deserializeUser: () => void;
    authenticate: () => (req: any, res: any, next: any) => any;
};
