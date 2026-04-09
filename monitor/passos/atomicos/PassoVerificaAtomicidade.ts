
// src/steps/PassoVerificaAtomicidade.ts

/**
 * Step responsável pela verificação de atomicidade
 * A IA analisa se a tarefa é complexa ou simples
 * Sendo simples, ela é atômica
 */

import { VerificaAtomicidadeOutput, 
        VerificaAtomicidadeSchema    
  } from '../../interfaces/retornosIA';
import { AIExecutionConfig, executeWithValidationLoopArgs, ExpectedOutcome, OutcomeType } from '../../services/universalEngine/interfaces/interfaceUniversalAgentEngine';
import { LLMOptions, LLMProvider } from '../../services/universalEngine/interfaces/interfaceLLM';
import { JSONSchema7 } from 'json-schema';
import { ConfiguracaoMonitor, ContextoExecucao, TarefaCompleta } from '../../interfaces';
import { PassoBase } from '../PassoBase';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { UniversalAgentEngine } from '../../services/universalEngine/universalAgentEngine';
import { Project } from '@prisma/client';
// ============================================================================
// INTERFACES (Contratos de Tipagem)
// ============================================================================

export type VerificaAtomicidadeInput = {
    tarefaAtual: TarefaCompleta;
    project: Project;
    config: ConfiguracaoMonitor;
    configIA: AIExecutionConfig;
}

export interface DependenciasVerificaAtomicidade {
    logger: any;
    FabricaPromptsIA: FabricaPromptsIA;
    motorUniversal: UniversalAgentEngine;
}

const path = require('path');
// ============================================================================
// CLASSE PRINCIPAL
// ============================================================================

class PassoVerificaAtomicidade extends PassoBase<VerificaAtomicidadeInput, VerificaAtomicidadeOutput> {
    readonly nome: string = 'VerificaçãodeAtomicidade';

    private log: any;
    private motorUniversal: any;
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(deps: DependenciasVerificaAtomicidade) {
        super(deps);
        this.motorUniversal = deps.motorUniversal;
    }

    async execute(input: VerificaAtomicidadeInput): Promise<VerificaAtomicidadeOutput> {
        return this.processar(input);
    }

    /**
     * Executa o step de planejamento do arquiteto
     * @param context - Contexto do pipeline (deve conter dados do SetupContextStep)
     * @returns Contexto atualizado com análise do arquiteto
     */
    async processar(input: VerificaAtomicidadeInput): Promise<VerificaAtomicidadeOutput> {
        const { 
            tarefaAtual, 
            project, 
            config,
            configIA, 
        } = input;
        let verificaAtomicidadeResult: VerificaAtomicidadeOutput = {
            isIdeal: false,
            confidence: 0,
            inferredDomain: null,
            reason: ''
        }
        if (!tarefaAtual || !configIA || !project || !configIA) {
            await this.log(`⚠️ ArchitectPlanningStep: contexto incompleto`);
            verificaAtomicidadeResult = {
                success: false,
                error: 'contexto incompleto (task, files ou config faltando)'
            }
            return verificaAtomicidadeResult;
        }
        
        const promptParaIA = await FabricaPromptsIA.gerarPromptParaVerificarAtomicidadeeDominio(tarefaAtual);

        const opcoesParaIA: LLMOptions = {
            provider: LLMProvider.OLLAMA,
            agentId: project.agent,
            sessionId: `session-${tarefaAtual.id}`,
            temperature: 0.5,
            timeout: config.TASK_TIMEOUT_MS/1000,
            model: project.modeloAuxiliar,
            format: VerificaAtomicidadeSchema as JSONSchema7,
        }
        const outcome: ExpectedOutcome = {
            type: OutcomeType.JSON,
            schema: VerificaAtomicidadeSchema
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
        const analise: VerificaAtomicidadeOutput 
        = await this.motorUniversal.executeWithValidationLoop(args);
       
        return analise;
    }
}

export default PassoVerificaAtomicidade;

