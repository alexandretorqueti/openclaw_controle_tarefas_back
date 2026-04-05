// src/steps/AnalisaTurnoEFeedback.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor_old";
import { log } from '../aux/logger';
import container from '../container';

export const passoAnalisaTurnoEFeedback: Passo = {
    name: 'Analisa Turno e Feedback',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, controleExecucao } = ctx;
        if (!tarefaAtual) return;

        const taskAnalysisService = container.resolve('taskAnalysisService');
        await log(`⚖️ Analisando progresso da tarefa ${tarefaAtual.id}...`);

        // 1. DETECTA TRUNCAMENTO (Erro de Sintaxe JSON)
        const raw = (controleExecucao.rawOutput || '').trim();
        // Melhora na detecção: se começa com { mas não termina com }
        controleExecucao.erroSintaxeJSON = raw.startsWith('{') && !raw.endsWith('}');

        // 2. ANÁLISE INTELIGENTE (O Juiz)
        let analysis = {
            isDeclaringDone: !!controleExecucao.doneExists,
            hasFulfilledContract: true,
            missingRequirements: [] as string[],
            isTalkingWithoutAction: false
        };

        // Só pulamos a análise pesada se houver .done E mudanças reais.
        // Se faltar um dos dois, chamamos a IA para entender o que houve.
        if (!controleExecucao.doneExists || !controleExecucao.hasRealChanges) {
            analysis = await taskAnalysisService.analyzeDeveloperTurn({
                rawOutput: raw,
                task: tarefaAtual,
                evidence: controleExecucao.evidence,
                doneExists: controleExecucao.doneExists
            });
        }

        // 3. CONSTRUÇÃO DO FEEDBACK (Hierarquia de importância)
        let feedback: string | null = null;

        if (controleExecucao.erroSintaxeJSON) {
            feedback = `[ERRO DE SINTAXE] Seu bloco JSON foi cortado/truncado. Por favor, reenvie a ferramenta completa fechando todos os blocos.`;
        } 
        else if (analysis.isDeclaringDone && !analysis.hasFulfilledContract) {
            feedback = `[SISTEMA] Você indicou que terminou, mas faltam requisitos:\n${analysis.missingRequirements.map(r => `- ${r}`).join('\n')}`;
        } 
        else if (analysis.isTalkingWithoutAction && !controleExecucao.doneExists) {
            feedback = `[SISTEMA] Você explicou o plano, mas não executou nenhuma ferramenta (tool_use). Aplique as mudanças no código agora.`;
        } 
        else if (!controleExecucao.doneExists) {
            feedback = `[SISTEMA] Progresso detectado. Continue trabalhando até concluir todos os requisitos e gerar o arquivo '.done'.`;
        }

        controleExecucao.feedbackForNextTurn = feedback;
        
        if (feedback) {
            await log(`) Feedback gerado para o próximo turno.`);
        } else {
            await log(`✅ Turno aprovado sem pendências.`);
        }
    }
};