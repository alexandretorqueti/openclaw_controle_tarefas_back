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

export interface DependenciasPreAnaliseEscopoTarerefa {
    logger: any;
    FabricaPromptsIA: FabricaPromptsIA;
    motorUniversal: UniversalAgentEngine;
}

const path = require('path');
// ============================================================================
// CLASSE PRINCIPAL
// ============================================================================

class passoPreAnaliseEscopoTarerefa extends PassoBase<ContextoExecucao, retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType> {
    readonly nome: string = 'PreAnaliseEscopoTarerefa';

    private log: any;
    private motorUniversal: any;
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(deps: DependenciasPreAnaliseEscopoTarerefa) {
        super(deps);
        this.motorUniversal = deps.motorUniversal;
    }

    async execute(context: ContextoExecucao): Promise<retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType> {
        return this.processar(context);
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
            configIA, 
        } = context;
        
        if (!tarefaAtual || !configIA || !project || !configIA) {
            await this.log(`⚠️ ArchitectPlanningStep: contexto incompleto`);
            context.architectPlanningResult = {
                success: false,
                error: 'contexto incompleto (task, files ou config faltando)'
            }
            return;
        }
        
        const promptParaIA = await FabricaPromptsIA.preAnaliseEEscopoDaTarefa(tarefaAtual, project);

        const opcoesParaIA: LLMOptions = {
            provider: LLMProvider.OLLAMA,
            agentId: project.agent,
            sessionId: `session-${tarefaAtual.id}`,
            temperature: 0.5,
            timeout: config.TASK_TIMEOUT_MS/1000,
            model: project.modeloAuxiliar,
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
            configIA: configIaExecution,
            ctx: context,
            llmOptions: opcoesParaIA
        }
        const analise: retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType 
        = await this.motorUniversal.executeWithValidationLoop(args);
       
        return analise;
    }
}

export default passoPreAnaliseEscopoTarerefa;