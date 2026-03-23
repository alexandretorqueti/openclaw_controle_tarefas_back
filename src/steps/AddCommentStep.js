// src/steps/AddCommentStep.js
/**
 * Step responsável por adicionar comentários a tarefas.
 * Usa o container para obter todas as dependências necessárias.
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
const container = require('../container');
class AddCommentStep {
    /**
     * Construtor que obtém todas as dependências do container.
     */
    constructor() {
        this.commentService = container.resolve('commentService');
        this.log = container.resolve('log');
    }
    /**
     * Executa o step de adição de comentário
     * @param {Object} context - Contexto do pipeline
     * @param {string} context.taskId - ID da tarefa
     * @param {string} context.content - Conteúdo do comentário
     * @param {string} context.userId - ID do usuário (opcional, pode vir do contexto global)
     * @returns {Promise<Object>} Contexto atualizado
     */
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { taskId, content, userId } = context;
            if (!taskId || !content) {
                yield this.log(`⚠️ AddCommentStep: taskId ou content não fornecidos`);
                return Object.assign(Object.assign({}, context), { commentResult: {
                        success: false,
                        error: 'taskId ou content não fornecidos'
                    } });
            }
            try {
                yield this.commentService.createComment({
                    taskId,
                    userId: userId || null,
                    content
                });
                yield this.log(`💬 Comentário adicionado à tarefa ${taskId}`);
                return Object.assign(Object.assign({}, context), { commentResult: {
                        success: true,
                        taskId,
                        content
                    } });
            }
            catch (error) {
                yield this.log(`⚠️ Erro ao adicionar comentário à tarefa ${taskId}: ${error.message}`);
                return Object.assign(Object.assign({}, context), { commentResult: {
                        success: false,
                        error: error.message,
                        taskId,
                        content
                    } });
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {string} taskId - ID da tarefa
     * @param {string} content - Conteúdo do comentário
     * @param {string} userId - ID do usuário (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static addComment(taskId, content, userId = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const step = new AddCommentStep();
            const result = yield step.execute({ taskId, content, userId });
            return result.commentResult;
        });
    }
}
module.exports = AddCommentStep;
