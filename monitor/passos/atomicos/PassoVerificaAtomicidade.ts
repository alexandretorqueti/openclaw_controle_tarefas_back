import { JSONSchema7 } from 'json-schema';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { PassoIAAbstrato } from '../passoIAAbstrato';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { ContextoExecucao } from '../../interfaces';
// ============================================================================
// INTERFACES (Contratos de Tipagem)
// ============================================================================

const retornoVerificaAtomicidade
    = z.object({
        isIdeal: z.boolean().describe('Indica se a tarefa tem o "Tamanho Ideal" para ser entregue a um desenvolvedor senior'),
        reason: z.string().optional().describe('Razão que justifica o reprovado'),
        confidence: z.number().min(0).max(100).default(0).describe('Confiança da tarefa'),
        inferredDomain: z.enum(['backend', 'frontend']).optional().describe('Domínio inferido da tarefa'),
        success: z.boolean().describe('Indica se a tarefa foi verificada com sucesso'),
        error: z.string().optional().describe('Se houve algum erro no seu processamento')
    });

export type VerificaAtomicidadeOutput = z.infer<typeof retornoVerificaAtomicidade>;
const VerificaAtomicidadeSchema: JSONSchema7 = zodToJsonSchema(retornoVerificaAtomicidade) as JSONSchema7;

const path = require('path');
// ============================================================================
// CLASSE PRINCIPAL
// ============================================================================

class PassoVerificaAtomicidade extends PassoIAAbstrato<ContextoExecucao, VerificaAtomicidadeOutput> {
    readonly nome: string = 'VerificaçãodeAtomicidade';
    protected readonly schema: JSONSchema7 = VerificaAtomicidadeSchema;

     /**
     * Define o que retornar caso os dados de input não sejam válidos.
     */
    protected getResultadoFallback(mensagemErro: string): VerificaAtomicidadeOutput {
        return {
            confidence: 0,
            error: mensagemErro,
            inferredDomain: null,
            isIdeal: false,
            reason: '',
            success: false,
        } as VerificaAtomicidadeOutput;
    }

    /**
     * Define como o prompt desta etapa específica é gerado.
     */
    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        return await FabricaPromptsIA.gerarPromptParaVerificarAtomicidadeeDominio(
            input.tarefaAtual, 
        );
    }

}

export default PassoVerificaAtomicidade;

