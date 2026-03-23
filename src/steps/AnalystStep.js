// src/steps/AnalystStep.js
/**
 * Step responsável por analisar e decompor tarefas complexas usando OpenClaw.
 * Implementa o padrão Pipeline Step com injeção via container para testabilidade.
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
class AnalystStep {
    /**
     * Construtor que obtém todas as dependências do container.
     * Para testes, o container deve ser previamente configurado com mocks.
     */
    constructor() {
        this.openClawService = container.resolve('openClawService');
        this.promptFactory = container.resolve('promptFactory');
        this.sessionChainUtils = container.resolve('sessionChainUtils');
        this.jsonUtils = container.resolve('jsonUtils');
        this.taskService = container.resolve('taskService');
        this.decompositionService = container.resolve('decompositionService');
        this.commentService = container.resolve('commentService');
        this.log = container.resolve('log');
        this.config = container.resolve('config');
        this.fileSystem = container.resolve('fileSystem');
        // Dependências built-in (não injetadas por padrão, mas podem ser mockadas)
        this.path = require('path');
    }
    /**
     * Executa o step de análise para uma tarefa
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa a ser analisada
     * @param {Object} context.project - Projeto relacionado (opcional)
     * @returns {Promise<Object>} Contexto atualizado com resultado da análise
     */
    execute(context) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            const { task } = context;
            try {
                yield this.log(`🔍 Chamando Arquiteto (OpenClaw) para decompor tarefa ${task.id}: ${task.title}`);
                // Usar sessão unificada baseada na cadeia de dependências
                const architectSessionId = yield this.sessionChainUtils.generateUnifiedSessionId(task.id, 'arquiteto');
                yield this.log(`🔗 Sessão do arquiteto (decomposição): ${architectSessionId}`);
                const architectLogFile = this.path.join(this.config.TASKS_DIR, `architect-${task.id}.log`);
                const primaryAgent = ((_a = task.project) === null || _a === void 0 ? void 0 : _a.agent) || ((_b = task.project) === null || _b === void 0 ? void 0 : _b.programadorBack) || 'main';
                const fallbackAgent = ((_c = task.project) === null || _c === void 0 ? void 0 : _c.programadorFront) || 'main';
                // Usando o PromptFactory de forma limpa
                const architectInput = this.promptFactory.buildDecompositionPrompt(task);
                const architectResult = yield this.openClawService.executeWithFallback(architectSessionId, architectInput, primaryAgent, fallbackAgent, ((_d = task.project) === null || _d === void 0 ? void 0 : _d.modeloAuxiliar) || null, this.config.TASKS_DIR, architectLogFile, (_e = task.project) === null || _e === void 0 ? void 0 : _e.pastaBase, this.config.TASK_TIMEOUT_MS);
                if (!architectResult.success) {
                    throw new Error(`Falha na execução do OpenClaw: ${architectResult.errorMessage}`);
                }
                // Extrai o JSON do rawOutput
                let subtasksPlan = [];
                try {
                    const jsonMatch = architectResult.rawOutput.match(/\[[\s\S]*?\]/);
                    if (!jsonMatch)
                        throw new Error("Nenhum array JSON encontrado na saída do agente.");
                    subtasksPlan = JSON.parse(architectResult.rawOutput);
                }
                catch (parseError) {
                    try {
                        // Tenta de novo com a função extractJson
                        subtasksPlan = this.jsonUtils.extractJsonObjects(architectResult.rawOutput);
                    }
                    catch (extractError) {
                        throw new Error(`Falha ao extrair o JSON da saída do OpenClaw: ${extractError.message}`);
                    }
                }
                // Verifica se subtasksPlan é um array de objetos ou outro array.
                if (Array.isArray(subtasksPlan) && subtasksPlan.length > 0 && Array.isArray(subtasksPlan[0])) {
                    subtasksPlan = subtasksPlan[0];
                }
                if (!Array.isArray(subtasksPlan) || subtasksPlan.length === 0 || subtasksPlan.length === 1) {
                    // Marcar essa tarefa como atômica e seguir para o fluxo normal.
                    yield this.taskService.updateTask(task.id, { isAtomic: true });
                    yield this._addComment(task.id, `🔍 **Análise Concluída pelo Arquiteto**\nEsta tarefa é atômica e não requer decomposição.`, context.userId);
                    yield this.log(`✅ Tarefa ${task.id} validada como atômica pelo arquiteto.`);
                    return Object.assign(Object.assign({}, context), { analysisResult: {
                            success: true,
                            subtasksCreated: 0,
                            isAtomic: true
                        } });
                }
                const mappedSubtasks = subtasksPlan.map(st => ({
                    title: st.title,
                    description: st.description,
                    domain: st.domain,
                    projectId: task.projectId,
                    statusId: task.statusId,
                    priorityId: task.priorityId,
                    userId: task.assignedToId,
                    agent: task.agent
                }));
                const decompositionResult = yield this.decompositionService.decompose(task.id, mappedSubtasks);
                yield this._addComment(task.id, `🔍 **Análise Concluída pelo Arquiteto**\nA funcionalidade foi dividida em ${mappedSubtasks.length} micro-tarefas sequenciais.`, context.userId);
                yield this.log(`✅ Tarefa ${task.id} decomposta pelo OpenClaw em ${mappedSubtasks.length} subtarefas.`);
                return Object.assign(Object.assign({}, context), { analysisResult: {
                        success: true,
                        subtasksCreated: mappedSubtasks.length,
                        subtasks: mappedSubtasks,
                        decompositionResult
                    } });
            }
            catch (error) {
                yield this.log(`💥 Erro ao chamar Arquiteto para tarefa ${task.id}: ${error.message}`);
                yield this._addComment(task.id, `❌ **Erro na Análise**\nFalha ao decompor tarefa: ${error.message}`, context.userId);
                return Object.assign(Object.assign({}, context), { analysisResult: {
                        success: false,
                        error: error.message
                    }, 
                    // Flag opcional para interromper pipeline
                    shouldAbort: true, abortReason: `Falha na análise: ${error.message}` });
            }
        });
    }
    /**
     * Adiciona um comentário a uma tarefa
     * @private
     */
    _addComment(taskId, content, userId = null) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.commentService.createComment({
                    taskId,
                    userId,
                    content
                });
            }
            catch (error) {
                yield this.log(`⚠️ Erro ao adicionar comentário: ${error.message}`);
            }
        });
    }
}
module.exports = AnalystStep;
