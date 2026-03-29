"use strict";
// src/steps/SuperValidacao.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoSuperValidacao = void 0;
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
const legacyTaskFailure_1 = require("../steps/adapters/legacyTaskFailure");
exports.passoSuperValidacao = {
    name: 'Super Validação',
    func: async (ctx) => {
        const { tarefaAtual, UserId, config } = ctx;
        if (!tarefaAtual)
            return;
        // Resolve os serviços pelo Container de DI
        const validationService = container_1.default.resolve('validationService');
        const taskService = container_1.default.resolve('taskService');
        // Só aciona a IA se a tarefa for complexa ou não tiver domínio
        if (tarefaAtual.isAtomic !== true || !tarefaAtual.domain) {
            await (0, logger_1.log)(`⚖️ Verificando complexidade e/ou inferindo domínio da tarefa [${tarefaAtual.id}]...`);
            try {
                // Chama o serviço de IA (agora via container)
                const validation = await validationService.validateWithAuxModel(tarefaAtual, tarefaAtual.project);
                if (!validation)
                    throw new Error("A IA de validação retornou um resultado vazio.");
                // Atualiza o objeto da tarefa na memória (As Migalhas!)
                tarefaAtual.isAtomic = validation.isAtomic;
                if (!tarefaAtual.domain && validation.domain) {
                    tarefaAtual.domain = validation.domain;
                    await (0, logger_1.log)(`🎯 Domínio inferido pela IA: ${tarefaAtual.domain}`);
                }
                // Salva no banco de dados para persistir as descobertas
                await taskService.updateTask(tarefaAtual.id, {
                    isAtomic: tarefaAtual.isAtomic,
                    domain: tarefaAtual.domain
                });
                await (0, logger_1.log)(`✅ Validação concluída: Atômica? ${tarefaAtual.isAtomic} | Domínio: ${tarefaAtual.domain || 'N/A'}`);
            }
            catch (validationError) {
                await (0, logger_1.log)(`💥 Erro na super-validação: ${validationError.message}`);
                try {
                    // Tenta fazer o clean-up legado (mover para a pasta de erro, etc)
                    await (0, legacyTaskFailure_1.handleTaskFailure)(tarefaAtual, validationError, UserId, {
                        API_URL: config.API_URL,
                        TASKS_DIR: config.TASKS_DIR,
                        ERROR_DIR: config.ERROR_DIR
                    });
                }
                catch (cleanupError) {
                    await (0, logger_1.log)(`⚠️ Falha ao executar limpeza no erro de validação: ${cleanupError.message}`);
                }
                // A MIGALHA NEGATIVA FATAL: Avisamos na prancheta que a validação falhou e o fluxo deve morrer
                tarefaAtual.erroValidacao = true;
            }
        }
        else {
            await (0, logger_1.log)(`⏩ Tarefa ${tarefaAtual.id} já é atômica e possui domínio (${tarefaAtual.domain}). Pulando validação com IA.`);
        }
    }
};
