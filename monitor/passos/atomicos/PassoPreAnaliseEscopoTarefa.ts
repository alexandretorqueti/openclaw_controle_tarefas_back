import { JSONSchema7 } from 'json-schema';
import { ContextoExecucao } from '../../interfaces';
import { retornoTipoDaTarefaType, retornoTipoDaTarefaSchema } from '../../interfaces/retornosIA';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { PassoIAAbstrato } from '../passoIAAbstrato';

export class PassoPreAnaliseEscopoTarefa extends PassoIAAbstrato<ContextoExecucao, retornoTipoDaTarefaType> {
    readonly nome = 'PreAnaliseEscopoTarefa';
    protected readonly schema: JSONSchema7 = retornoTipoDaTarefaSchema;

    protected getResultadoFallback(mensagemErro: string): retornoTipoDaTarefaType {
        return {
            taskType: 'development',
            expectedLayers: [],
            difficult: 0,
            error: mensagemErro,
            success: false
        };
    }

    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        return FabricaPromptsIA.preAnaliseEEscopoDaTarefa(
            input.tarefaAtual, 
            input.project
        );
    }
}

export default PassoPreAnaliseEscopoTarefa;
