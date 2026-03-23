// src/steps/GetNextTaskStep.js
/**
 * Step responsável por obter a próxima tarefa elegível para execução.
 * Faz requisição à API e trata casos de fila vazia ou erros.
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
class GetNextTaskStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = container.resolve('log');
        this.config = container.resolve('config');
        this.axios = options.axios || container.resolve('axios');
    }
    /**
     * Executa o step para obter próxima tarefa
     * @param {Object} context - Contexto do pipeline
     * @param {string} context.nickname - Nickname do usuário
     * @param {string} context.apiUrl - URL da API (opcional, usa config.API_URL por padrão)
     * @returns {Promise<Object>} Contexto atualizado com tarefa encontrada
     */
    execute(context) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const { nickname } = context;
            const apiUrl = context.apiUrl || this.config.API_URL;
            if (!nickname) {
                yield this.log(`⚠️ GetNextTaskStep: nickname não fornecido`);
                return Object.assign(Object.assign({}, context), { nextTaskResult: {
                        success: false,
                        error: 'nickname não fornecido',
                        task: null
                    } });
            }
            try {
                yield this.log(`🔍 Buscando próxima tarefa elegível para usuário "${nickname}"`);
                const response = yield this.axios.get(`${apiUrl}/api/users/nickname/${nickname}/next-task`);
                // Se a API retornar uma tarefa válida, nós a devolvemos
                if (response.data && ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.task) === null || _b === void 0 ? void 0 : _b.id)) {
                    const task = response.data.task;
                    yield this.log(`✅ Tarefa ${task.id} encontrada: "${task.title}"`);
                    return Object.assign(Object.assign({}, context), { nextTaskResult: {
                            success: true,
                            task,
                            found: true,
                            taskId: task.id
                        }, task // Adiciona a tarefa ao contexto para próximos steps
                     });
                }
                // Tarefa não encontrada (mas API retornou 200 com dados vazios)
                yield this.log(`ℹ️ Nenhuma tarefa encontrada para "${nickname}" (API retornou 200 sem tarefa)`);
                return Object.assign(Object.assign({}, context), { nextTaskResult: {
                        success: true,
                        task: null,
                        found: false,
                        message: 'Nenhuma tarefa encontrada'
                    } });
            }
            catch (error) {
                // Se a API retornar 404 (Not Found) ou 204 (No Content), significa que a fila está vazia.
                // Isso é um comportamento esperado, então não precisamos logar como um erro crítico.
                if (error.response && (error.response.status === 404 || error.response.status === 204)) {
                    yield this.log(`ℹ️ Nenhuma tarefa disponível para "${nickname}" (API: ${error.response.status})`);
                    return Object.assign(Object.assign({}, context), { nextTaskResult: {
                            success: true,
                            task: null,
                            found: false,
                            apiStatus: error.response.status,
                            message: 'Fila vazia - comportamento esperado'
                        } });
                }
                // Outros erros (network, server error, etc.)
                yield this.log(`❌ Erro ao buscar tarefa elegível na API: ${error.message}`);
                return Object.assign(Object.assign({}, context), { nextTaskResult: {
                        success: false,
                        error: error.message,
                        task: null,
                        found: false
                    }, shouldAbort: true, abortReason: `Falha ao buscar próxima tarefa: ${error.message}` });
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {string} nickname - Nickname do usuário
     * @param {string} apiUrl - URL da API (opcional)
     * @returns {Promise<Object|null>} Tarefa encontrada ou null
     */
    static getNextTask(nickname, apiUrl = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const step = new GetNextTaskStep();
            const result = yield step.execute({ nickname, apiUrl });
            return result.nextTaskResult;
        });
    }
}
module.exports = GetNextTaskStep;
