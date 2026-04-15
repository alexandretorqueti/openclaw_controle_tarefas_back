import { JSONSchema7 } from 'json-schema';
import { PassoBase } from './PassoBase';
import { 
    AIExecutionConfig, 
    executeWithValidationLoopArgs, 
    ExpectedOutcome, 
    OutcomeType 
} from '../services/universalEngine/interfaces/interfaceUniversalAgentEngine';
import { LLMOptions, LLMProvider } from '../services/universalEngine/interfaces/interfaceLLM';
import { UniversalAgentEngine } from '../services/universalEngine/universalAgentEngine';
import { DependenciasGlobais } from '../Orquestrador';

// ============================================================================
// INTERFACES BASE
// ============================================================================

/**
 * Interface que garante que qualquer input de Step de IA tenha os dados mínimos necessários.
 * Seus tipos específicos (ContextoExecucao, VerificaAtomicidadeInput) já atendem a isso.
 */
export interface BaseIAInput {
    tarefaAtual: any; // Substitua pelo tipo real se preferir, ex: TarefaCompleta
    project?: any;     // Project
    config?: any;      // ConfiguracaoMonitor
    configIA?: any;    // AIExecutionConfig
}



// ============================================================================
// CLASSE ABSTRATA
// ============================================================================

/**
 * Classe base para todos os passos do pipeline que executam chamadas de IA.
 * Implementa o padrão Template Method para unificar o boilerplate.
 */
export abstract class PassoIAAbstrato<TInput extends BaseIAInput, TOutput> extends PassoBase<TInput, TOutput> {
    protected motorUniversal: UniversalAgentEngine;
    protected log: any;

    // ------------------------------------------------------------------------
    // CONTRATOS OBRIGATÓRIOS (As classes filhas DEVEM implementar)
    // ------------------------------------------------------------------------
    abstract readonly nome: string;
    protected abstract readonly schema: JSONSchema7;
    
    /** Retorna o objeto padrão caso ocorra erro de validação de contexto */
    protected abstract getResultadoFallback(mensagemErro: string): TOutput;
    
    /** Constrói o prompt específico daquele passo */
    protected abstract construirPrompt(input: TInput): Promise<string>;

    // ------------------------------------------------------------------------

    constructor(deps: DependenciasGlobais) {
        super(deps as any);
        this.motorUniversal = deps.motorUniversal;
        this.log = deps.logger || console.log;
    }

    /**
     * Orquestra o fluxo padrão de validação, formatação e chamada da IA.
     */
    async processar(input: TInput): Promise<TOutput> {
        const { tarefaAtual, project, config, configIA } = input;

        // 1. Validação de Contexto Unificada
        if (!tarefaAtual || !configIA || !project) {
            const erro = `⚠️ ${this.nome}: contexto incompleto (task, project ou configIA faltando)`;
            await this.log(erro);
            return this.getResultadoFallback(erro);
        }
        
        // 2. Construção do Prompt (Delegado para a classe filha)
        const promptParaIA = await this.construirPrompt(input);

        // 3. Montagem das Configurações do LLM
        const opcoesParaIA: LLMOptions = {
            provider: LLMProvider.OPENCLAW,
            agentId: project.agent,
            sessionId: `session-${tarefaAtual.id}`,
            temperature: 0.5,
            timeout: config.TASK_TIMEOUT_MS ,
            model: project.modeloAuxiliar,
            format: this.schema,
        };

        const outcome: ExpectedOutcome = {
            type: OutcomeType.JSON,
            schema: this.schema
        };

        const configIaExecution: AIExecutionConfig = {
            agentId: project.agent,
            systemPrompt: "",
            userPrompt: promptParaIA,
            expectedOutcomes: [outcome],
        };

        const args: executeWithValidationLoopArgs = {
            configIA: configIaExecution,
            llmOptions: opcoesParaIA
        };

        // 4. Execução via Motor Universal
        const resultadoIA: TOutput = await this.motorUniversal.executeWithValidationLoop(args);
       
        return resultadoIA;
    }
}