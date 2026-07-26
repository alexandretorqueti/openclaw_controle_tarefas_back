import { JSONSchema7 } from 'json-schema';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { PassoIAAbstrato } from '../passoIAAbstrato';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { ContextoExecucao } from '../../interfaces';

const retornoDecomposicao = z.object({
    precisaDividir: z.boolean().describe('Indica se a tarefa deve ser fragmentada'),
    motivo: z.string().describe('Explicação da decisão'),
    subtarefas: z.array(z.object({
        title: z.string().describe('Título da sub-tarefa'),
        description: z.string().describe('Instruções técnicas'),
        domain: z.enum(['FRONTEND', 'BACKEND', 'INFRASTRUCTURE', 'FULLSTACK'])
    })),
    success: z.boolean().default(true),
    error: z.string().optional()
});

export type DecompoeTarefaOutput = z.infer<typeof retornoDecomposicao>;
const DecomposicaoSchema: JSONSchema7 = zodToJsonSchema(retornoDecomposicao) as JSONSchema7;

export class PassoDecompoeTarefa extends PassoIAAbstrato<Readonly<ContextoExecucao>, DecompoeTarefaOutput> {
    readonly nome: string = 'DecomposiçãoDeTarefa';
    protected readonly schema: JSONSchema7 = DecomposicaoSchema;

    protected getResultadoFallback(mensagemErro: string): DecompoeTarefaOutput {
        return {
            precisaDividir: false,
            motivo: 'Erro ao processar decomposição',
            subtarefas: [],
            success: false,
            error: mensagemErro
        };
    }

    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        return FabricaPromptsIA.gerarPromptDecomposicao(input.tarefaAtual);
    }
}

export default PassoDecompoeTarefa;
