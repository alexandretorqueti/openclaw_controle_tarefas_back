import { z } from 'zod';

/**
 * Step responsável pela análise e planejamento do arquiteto.
 * O arquiteto analisa a tarefa, gera um plano de ação e pode até executar a tarefa.
 * Inclui validação inteligente de evidências e decisão de fluxo.
 */

import { retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType, 
    retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoSchema } from '../../interfaces/retornosIA';
import { AIExecutionConfig, executeWithValidationLoopArgs, ExpectedOutcome, OutcomeType } from '../../services/universalEngine/interfaces/interfaceUniversalAgentEngine';
import { LLMOptions, LLMProvider } from '../../services/universalEngine/interfaces/interfaceLLM';
import { JSONSchema7 } from 'json-schema';
import { ContextoExecucao } from '../../interfaces';
import { DependenciasBase, PassoBase } from '../PassoBase';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { UniversalAgentEngine } from '../../services/universalEngine/universalAgentEngine';
// ============================================================================
// INTERFACES (Contratos de Tipagem)
// ============================================================================
export interface preAnaliseEscopoTarefaIn {

}


export interface DependenciasPreAnaliseEscopoTarerefa {
    logger: any;
    FabricaPromptsIA: FabricaPromptsIA;
    motorUniversal: UniversalAgentEngine;
}

const path = require('path');
// ============================================================================
// CLASSE PRINCIPAL
// ============================================================================

class passoPreAnaliseEscopoTarerefa extends PassoBase<preAnaliseEscopoTarefaIn, retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType> {
    readonly nome: string = 'PreAnaliseEscopoTarerefa';

    private log: any;
    private FabricaPromptsIA: any;
    private motorUniversal: any;
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(deps: DependenciasPreAnaliseEscopoTarerefa) {
        super(deps);
        this.FabricaPromptsIA = deps.FabricaPromptsIA;
        this.motorUniversal = deps.motorUniversal;
    }

    /**
     * Executa o step de planejamento do arquiteto
     * @param context - Contexto do pipeline (deve conter dados do SetupContextStep)
     * @returns Contexto atualizado com análise do arquiteto
     */
    async processar(context: ContextoExecucao): Promise<retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType> {
        const { 
            tarefaAtual, 
            project, 
            files, 
            initialSnapshot, 
            config, 
        } = context;
        
        if (!tarefaAtual || !files || !config) {
            await this.log(`⚠️ ArchitectPlanningStep: contexto incompleto`);
            context.architectPlanningResult = {
                success: false,
                error: 'contexto incompleto (task, files ou config faltando)'
            }
            return;
        }
        
        const promptParaIA = await this.FabricaPromptsIA.getArchitectPlanningPrompt(tarefaAtual, project, files, initialSnapshot);

        const opcoesParaIA: LLMOptions = {
            provider: LLMProvider.OPENCLAW,
            agentId: project.agent,
            sessionId: `session-${tarefaAtual.id}`,
            temperature: 0.5,
            timeout: config.TASK_TIMEOUT_MS/1000,
            format: retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoSchema as JSONSchema7,
        }
        const outcome: ExpectedOutcome = {
            type: OutcomeType.JSON,
            schema: retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoSchema
        }
        const configIaExecution: AIExecutionConfig = {
            agentId: project.agent,
            systemPrompt: "",
            userPrompt: promptParaIA,
            expectedOutcomes: [outcome],
        };

        const args: executeWithValidationLoopArgs = {
            config: configIaExecution,
            ctx: context,
            llmOptions: opcoesParaIA
        }
        const analise: retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType 
        = await this.motorUniversal.executeWithValidationLoop(args);
       
        return analise;
    }
}

export default passoPreAnaliseEscopoTarerefa;