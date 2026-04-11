import { JSONSchema7 } from 'json-schema';
import { executeWithValidationLoopArgs, OutcomeType } from './interfaces/interfaceUniversalAgentEngine';
import { LLMOptions, LLMProvider } from './interfaces/interfaceLLM';
import { PassoBase } from '../../passos';
import { ServicosDoMonitor } from '../../interfaces';
import { DependenciasBase } from '../../passos';
// ... suas outras importações

export interface PassoConfig<TInput, TOutput> {
    nome: string;
    schema: JSONSchema7;
    geradorDePrompt: (input: TInput) => Promise<string>;
    resultadoFalha: TOutput; // O objeto retornado caso falte contexto
}

class PassoGenericoIA<TInput, TOutput> extends PassoBase<TInput, TOutput> {
    readonly nome: string;
    private configPasso: PassoConfig<TInput, TOutput>;
    private motorUniversal: any;
    
    constructor(deps: ServicosDoMonitor, configPasso: PassoConfig<TInput, TOutput>) {
        super(deps);
        this.motorUniversal = deps.motorUniversal;
        this.configPasso = configPasso;
        this.nome = configPasso.nome;
    }

    async processar(input: any): Promise<TOutput> {
        const { tarefaAtual, project, config, configIA } = input;
        
        if (!tarefaAtual || !configIA || !project) {
            await this.logger.erro(`⚠️ ${this.nome}: contexto incompleto`);
            return this.configPasso.resultadoFalha;
        }

        // Usa a função injetada para gerar o prompt
        const promptParaIA = await this.configPasso.geradorDePrompt(input);

        const opcoesParaIA: LLMOptions = {
            provider: LLMProvider.OLLAMA,
            agentId: project.agent,
            sessionId: `session-${tarefaAtual.id}`,
            temperature: 0.5,
            timeout: config.TASK_TIMEOUT_MS / 1000,
            model: project.modeloAuxiliar,
            format: this.configPasso.schema,
        };

        const args: executeWithValidationLoopArgs = {
            configIA: {
                agentId: project.agent,
                systemPrompt: "",
                userPrompt: promptParaIA,
                expectedOutcomes: [{ type: OutcomeType.JSON, schema: this.configPasso.schema }],
            },
            llmOptions: opcoesParaIA
        };

        return await this.motorUniversal.executeWithValidationLoop(args);
    }
}