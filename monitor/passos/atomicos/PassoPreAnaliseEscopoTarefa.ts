import { JSONSchema7 } from 'json-schema';
import { ContextoExecucao } from '../../interfaces/tipos';
import { retornoTipoDaTarefaType, retornoTipoDaTarefaSchema } from '../../interfaces/retornosIA';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { PassoIAAbstrato } from '../passoIAAbstrato';

export class passoPreAnaliseEscopoTarerefa extends PassoIAAbstrato<ContextoExecucao, retornoTipoDaTarefaType> {
    readonly nome = 'PreAnaliseEscopoTarerefa';
    protected readonly schema: JSONSchema7 = retornoTipoDaTarefaSchema;

    /**
     * Define o que retornar caso os dados de input não sejam válidos.
     */
    protected getResultadoFallback(mensagemErro: string): retornoTipoDaTarefaType {
        return {
            taskType: 'development',
            expectedLayers: [],
            difficult: 0,
            error: mensagemErro,
            success: false
        };
    }

    /**
     * Define como o prompt desta etapa específica é gerado.
     */
    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        return await FabricaPromptsIA.preAnaliseEEscopoDaTarefa(
            input.tarefaAtual, 
            input.project
        );
    }
}

export default passoPreAnaliseEscopoTarerefa;