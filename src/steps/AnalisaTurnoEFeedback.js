"use strict";
// src/steps/AnalisaTurnoEFeedback.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoAnalisaTurnoEFeedback = void 0;
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
exports.passoAnalisaTurnoEFeedback = {
    name: 'Analisa Turno e Feedback',
    func: async (ctx) => {
        const { tarefaAtual } = ctx;
        if (!tarefaAtual)
            return;
        const taskAnalysisService = container_1.default.resolve('taskAnalysisService');
        await (0, logger_1.log)(`⚖️ Analisando progresso da tarefa ${tarefaAtual.id}...`);
        // 1. DETECTA TRUNCAMENTO (Erro de Sintaxe JSON)
        const raw = (tarefaAtual.rawOutput || '').trim();
        // Melhora na detecção: se começa com { mas não termina com }
        tarefaAtual.erroSintaxeJSON = raw.startsWith('{') && !raw.endsWith('}');
        // 2. ANÁLISE INTELIGENTE (O Juiz)
        let analysis = {
            isDeclaringDone: !!tarefaAtual.doneExists,
            hasFulfilledContract: true,
            missingRequirements: [],
            isTalkingWithoutAction: false
        };
        // Só pulamos a análise pesada se houver .done E mudanças reais.
        // Se faltar um dos dois, chamamos a IA para entender o que houve.
        if (!tarefaAtual.doneExists || !tarefaAtual.hasRealChanges) {
            analysis = await taskAnalysisService.analyzeDeveloperTurn({
                rawOutput: raw,
                task: tarefaAtual,
                evidence: tarefaAtual.evidence,
                doneExists: tarefaAtual.doneExists
            });
        }
        // 3. CONSTRUÇÃO DO FEEDBACK (Hierarquia de importância)
        let feedback = null;
        if (tarefaAtual.erroSintaxeJSON) {
            feedback = `[ERRO DE SINTAXE] Seu bloco JSON foi cortado/truncado. Por favor, reenvie a ferramenta completa fechando todos os blocos.`;
        }
        else if (analysis.isDeclaringDone && !analysis.hasFulfilledContract) {
            feedback = `[SISTEMA] Você indicou que terminou, mas faltam requisitos:\n${analysis.missingRequirements.map(r => `- ${r}`).join('\n')}`;
        }
        else if (analysis.isTalkingWithoutAction && !tarefaAtual.doneExists) {
            feedback = `[SISTEMA] Você explicou o plano, mas não executou nenhuma ferramenta (tool_use). Aplique as mudanças no código agora.`;
        }
        else if (!tarefaAtual.doneExists) {
            feedback = `[SISTEMA] Progresso detectado. Continue trabalhando até concluir todos os requisitos e gerar o arquivo '.done'.`;
        }
        tarefaAtual.feedbackForNextTurn = feedback;
        if (feedback) {
            await (0, logger_1.log)(`) Feedback gerado para o próximo turno.`);
        }
        else {
            await (0, logger_1.log)(`✅ Turno aprovado sem pendências.`);
        }
    }
};
