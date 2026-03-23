// src/steps/adapters/legacyAddComment.js
/**
 * Adaptador para manter compatibilidade com a função addComment original.
 * Usa o container para obter todas as dependências.
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
const container = require('../../container');
/**
 * Cria a função addComment compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: UserIdJarbas)
 * @returns {Function} Função addComment(taskId, content)
 */
function createLegacyAddComment(defaultUserId = null) {
    // Importar AddCommentStep (evita circular dependency)
    const AddCommentStep = require('../AddCommentStep');
    // Criar instância do step (o construtor já obtém tudo do container)
    const addCommentStep = new AddCommentStep();
    /**
     * Função compatível com a addComment original
     * @param {string} taskId - ID da tarefa
     * @param {string} content - Conteúdo do comentário
     * @returns {Promise<void>}
     */
    return function addComment(taskId, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield addCommentStep.execute({
                    taskId,
                    content,
                    userId: defaultUserId
                });
                // A função original não retorna nada, apenas silencia erros
            }
            catch (error) {
                // Erro já foi logado pelo step, não precisamos fazer nada aqui
                // A função original apenas loga e continua
            }
        });
    };
}
/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: addComment(taskId, content, userId)
 * Usa userId se fornecido, caso contrário usa padrão do container
 */
function addComment(taskId, content, userId = null) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const step = new (require('../AddCommentStep'))();
            yield step.execute({
                taskId,
                content,
                userId: userId || null
            });
        }
        catch (error) {
            // Erro já logado pelo step
        }
    });
}
module.exports = { createLegacyAddComment, addComment };
