import { JSONSchema7 } from 'json-schema';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { PassoIAAbstrato } from '../passoIAAbstrato';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { ContextoExecucao } from '../../interfaces';

const retornoVerificaAtomicidade = z.object({
    isIdeal: z.boolean().describe('Indica se a tarefa tem o "Tamanho Ideal" para ser entregue a um desenvolvedor senior'),
    reason: z.string().optional().describe('Razão que justifica o reprovado'),
    confidence: z.number().min(0).max(100).default(0).describe('Confiança da tarefa'),
    inferredDomain: z.enum(['backend', 'frontend']).optional().describe('Domínio inferido da tarefa'),
    success: z.boolean().describe('Indica se a tarefa foi verificada com sucesso'),
    error: z.string().optional().describe('Se houve algum erro no seu processamento')
});

export type VerificaAtomicidadeOutput = z.infer<typeof retornoVerificaAtomicidade>;
const VerificaAtomicidadeSchema: JSONSchema7 = zodToJsonSchema(retornoVerificaAtomicidade) as JSONSchema7;

export class PassoVerificaAtomicidade extends PassoIAAbstrato<ContextoExecucao, VerificaAtomicidadeOutput> {
    readonly nome: string = 'VerificaçãoDeAtomicidade';
    protected readonly schema: JSONSchema7 = VerificaAtomicidadeSchema;

    protected getResultadoFallback(mensagemErro: string): VerificaAtomicidadeOutput {
        return {
            isIdeal: false,
            reason: mensagemErro,
            confidence: 0,
            success: false,
            error: mensagemErro
        };
    }

    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        return FabricaPromptsIA.gerarPromptParaVerificarAtomicidadeeDominio(input.tarefaAtual);
    }
}

export default PassoVerificaAtomicidade;
