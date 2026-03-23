var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// src/services/avatarService.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();
class AvatarService {
    /**
     * Inicializa o serviço (cria diretório se não existir)
     */
    static init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.mkdir(this.AVATARS_DIR, { recursive: true });
                console.log(`✅ AvatarService inicializado: ${this.AVATARS_DIR}`);
            }
            catch (error) {
                console.error('❌ Erro ao inicializar AvatarService:', error);
            }
        });
    }
    /**
     * Faz upload de avatar para um agente
     * @param {string} agentId - ID do agente
     * @param {Object} file - Objeto file do multer
     * @returns {Promise<Object>} - Informações do avatar salvo
     */
    static uploadAvatar(agentId, file) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validar entrada
                if (!agentId || !file) {
                    throw new Error('agentId e file são obrigatórios');
                }
                // Gerar nome único para o arquivo
                const fileExt = path.extname(file.originalname).toLowerCase();
                const uniqueFilename = `${uuidv4()}${fileExt}`;
                // Caminho relativo e absoluto
                const relativePath = `${agentId}/${uniqueFilename}`;
                const absolutePath = path.join(this.AVATARS_DIR, relativePath);
                // Criar diretório do agente se não existir
                const agentDir = path.join(this.AVATARS_DIR, agentId);
                yield fs.mkdir(agentDir, { recursive: true });
                // Mover arquivo para diretório final
                yield fs.rename(file.path, absolutePath);
                // Salvar metadados no banco
                const avatarRecord = yield prisma.agentAvatar.upsert({
                    where: { agentId },
                    update: {
                        filename: uniqueFilename,
                        mimeType: file.mimetype,
                        path: relativePath,
                        size: file.size,
                        updatedAt: new Date()
                    },
                    create: {
                        agentId,
                        filename: uniqueFilename,
                        mimeType: file.mimetype,
                        path: relativePath,
                        size: file.size
                    }
                });
                // URL para acesso
                const avatarUrl = `/agent-avatars/${relativePath}`;
                return {
                    success: true,
                    avatar: avatarRecord,
                    avatarUrl,
                    message: 'Avatar atualizado com sucesso'
                };
            }
            catch (error) {
                console.error('Erro no upload de avatar:', error);
                throw error;
            }
        });
    }
    /**
     * Obtém informações do avatar de um agente
     * @param {string} agentId - ID do agente
     * @returns {Promise<Object|null>} - Informações do avatar ou null
     */
    static getAvatar(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const avatar = yield prisma.agentAvatar.findUnique({
                    where: { agentId }
                });
                if (!avatar) {
                    return null;
                }
                // Verificar se arquivo físico existe
                const absolutePath = path.join(this.AVATARS_DIR, avatar.path);
                try {
                    yield fs.access(absolutePath);
                }
                catch (_a) {
                    // Arquivo não existe, remover do banco
                    yield this.deleteAvatar(agentId);
                    return null;
                }
                return Object.assign(Object.assign({}, avatar), { avatarUrl: `/agent-avatars/${avatar.path}` });
            }
            catch (error) {
                console.error('Erro ao obter avatar:', error);
                return null;
            }
        });
    }
    /**
     * Remove avatar de um agente
     * @param {string} agentId - ID do agente
     * @returns {Promise<boolean>} - true se removido, false se não existia
     */
    static deleteAvatar(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const avatar = yield prisma.agentAvatar.findUnique({
                    where: { agentId }
                });
                if (!avatar) {
                    return false;
                }
                // Remover arquivo físico
                const absolutePath = path.join(this.AVATARS_DIR, avatar.path);
                try {
                    yield fs.unlink(absolutePath);
                }
                catch (error) {
                    console.warn(`Arquivo não encontrado: ${absolutePath}`);
                }
                // Remover diretório do agente se estiver vazio
                const agentDir = path.join(this.AVATARS_DIR, agentId);
                try {
                    const files = yield fs.readdir(agentDir);
                    if (files.length === 0) {
                        yield fs.rmdir(agentDir);
                    }
                }
                catch (error) {
                    // Ignorar erro se diretório não existir
                }
                // Remover do banco
                yield prisma.agentAvatar.delete({
                    where: { agentId }
                });
                return true;
            }
            catch (error) {
                console.error('Erro ao remover avatar:', error);
                throw error;
            }
        });
    }
    /**
     * Serve arquivo de avatar
     * @param {string} agentId - ID do agente
     * @param {string} filename - Nome do arquivo
     * @returns {Promise<Object>} - Informações do arquivo
     */
    static serveAvatarFile(agentId, filename) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Construir caminho
                const relativePath = `${agentId}/${filename}`;
                const absolutePath = path.join(this.AVATARS_DIR, relativePath);
                // Verificar se arquivo existe
                yield fs.access(absolutePath);
                // Ler metadados do banco para validar
                const avatar = yield prisma.agentAvatar.findUnique({
                    where: { agentId }
                });
                if (!avatar || avatar.filename !== filename) {
                    throw new Error('Avatar não encontrado ou não pertence ao agente');
                }
                // Ler arquivo
                const fileBuffer = yield fs.readFile(absolutePath);
                return {
                    buffer: fileBuffer,
                    mimeType: avatar.mimeType,
                    size: avatar.size,
                    filename: avatar.filename
                };
            }
            catch (error) {
                console.error('Erro ao servir arquivo de avatar:', error);
                throw error;
            }
        });
    }
    /**
     * Obtém URL do avatar para um agente
     * @param {string} agentId - ID do agente
     * @returns {Promise<string|null>} - URL do avatar ou null
     */
    static getAvatarUrl(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const avatar = yield this.getAvatar(agentId);
            return avatar ? avatar.avatarUrl : null;
        });
    }
}
// Diretório base para avatares
AvatarService.AVATARS_DIR = path.join(__dirname, '../../public/agent-avatars');
// Inicializar ao carregar
AvatarService.init().catch(console.error);
module.exports = AvatarService;
