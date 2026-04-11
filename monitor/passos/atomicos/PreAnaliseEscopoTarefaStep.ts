
// src/steps/PreAnaliseEscopoTarerefaStep.ts

/**
 * Step responsável pela análise e planejamento do arquiteto.
 * O arquiteto analisa a tarefa, gera um plano de ação e pode até executar a tarefa.
 * Inclui validação inteligente de evidências e decisão de fluxo.
 */

import { retornoTipoDaTarefaType, 
    retornoTipoDaTarefaSchema } from '../../interfaces/retornosIA';
import { AIExecutionConfig, executeWithValidationLoopArgs, ExpectedOutcome, OutcomeType } from '../../services/universalEngine/interfaces/interfaceUniversalAgentEngine';
import { LLMOptions, LLMProvider } from '../../services/universalEngine/interfaces/interfaceLLM';
import { JSONSchema7 } from 'json-schema';
import { ContextoExecucao } from '../../interfaces';
import { PassoBase } from '../PassoBase';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { UniversalAgentEngine } from '../../services/universalEngine/universalAgentEngine';
import { LoggerConsole as Logger } from '../../utils/LoggerConsole';
import { DependenciasGlobais } from '../../Orquestrador';

const path = require('path');
// ============================================================================
// CLASSE PRINCIPAL
// ============================================================================

class passoPreAnaliseEscopoTarerefa extends PassoBase<ContextoExecucao, retornoTipoDaTarefaType> {
    readonly nome: string = 'PreAnaliseEscopoTarerefa';

    private motorUniversal: any;
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(deps: DependenciasGlobais) {
        super(deps);
        this.motorUniversal = deps.motorUniversal;
    }

    /**
     * Executa o step de planejamento do arquiteto
     * @param context - Contexto do pipeline (deve conter dados do SetupContextStep)
     * @returns Contexto atualizado com análise do arquiteto
     */
    async processar(context: ContextoExecucao): Promise<retornoTipoDaTarefaType> {
        const { 
            tarefaAtual, 
            project, 
            config,
            configIA, 
        } = context;
        let architectPlanningResult: retornoTipoDaTarefaType = {
            taskType: 'development',
            expectedLayers: [],
            difficult: 0,
            error: '',
            success: false
        }
        if (!tarefaAtual || !configIA || !project || !configIA) {
            await this.logger.erro(`⚠️ ArchitectPlanningStep: contexto incompleto`);
            architectPlanningResult = {
                success: false,
                error: 'contexto incompleto (task, files ou config faltando)'
            }
            return architectPlanningResult;
        }
        
        const promptParaIA = await FabricaPromptsIA.preAnaliseEEscopoDaTarefa(tarefaAtual, project);

        const opcoesParaIA: LLMOptions = {
            provider: LLMProvider.OLLAMA,
            agentId: project.agent,
            sessionId: `session-${tarefaAtual.id}`,
            temperature: 0.5,
            timeout: config.TASK_TIMEOUT_MS/1000,
            model: project.modeloAuxiliar,
            format: retornoTipoDaTarefaSchema as JSONSchema7,
        }
        const outcome: ExpectedOutcome = {
            type: OutcomeType.JSON,
            schema: retornoTipoDaTarefaSchema
        }
        const configIaExecution: AIExecutionConfig = {
            agentId: project.agent,
            systemPrompt: "",
            userPrompt: promptParaIA,
            expectedOutcomes: [outcome],
        };

        const args: executeWithValidationLoopArgs = {
            configIA: configIaExecution,
            llmOptions: opcoesParaIA
        }
        const analise: retornoTipoDaTarefaType 
        = await this.motorUniversal.executeWithValidationLoop(args);
       
        return analise;
    }
}

export default passoPreAnaliseEscopoTarerefa;

