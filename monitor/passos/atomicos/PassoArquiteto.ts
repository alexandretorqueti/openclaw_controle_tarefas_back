import { JSONSchema7 } from 'json-schema';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { PassoIAAbstrato } from '../passoIAAbstrato';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { ContextoExecucao, TarefaCompleta } from '../../interfaces';

const retornoArquiteto = z.object({
    planDetails: z.string().describe('O plano arquitetural detalhado passo a passo para o programador implementar.'),
    architectNotes: z.string().optional().describe('Notas adicionais, considerações de design ou avisos de arquitetura.'),
    isFullyImplemented: z.boolean().describe('Verdadeiro APENAS se a tarefa for trivial e você já tiver resolvido tudo completamente na sua análise, dispensando a fase de programação.'),
    success: z.boolean().describe('Indica se a análise e o plano foram gerados com sucesso.'),
    error: z.string().optional().describe('Se houve algum erro no processamento.')
});

export type ArquitetoOutput = z.infer<typeof retornoArquiteto>;
const ArquitetoSchema: JSONSchema7 = zodToJsonSchema(retornoArquiteto) as JSONSchema7;

export class PassoArquiteto extends PassoIAAbstrato<ContextoExecucao, ArquitetoOutput> {
    readonly nome: string = 'AnaliseEPlanejamentoArquiteto';
    protected readonly schema: JSONSchema7 = ArquitetoSchema;

    protected getResultadoFallback(mensagemErro: string): ArquitetoOutput {
        return {
            planDetails: '',
            isFullyImplemented: false,
            success: false,
            error: mensagemErro
        };
    }

    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        // Passamos uma string vazia para o caminho do arquivo, pois não persistimos mais em disco nesta fase.
        return FabricaPromptsIA.gerarPromptArquiteto(
            input.tarefaAtual!,
            input.project,
            '', 
            input.outputPassos?.preanalise?.taskType || 'development',
            this.gerarSecaoComentarios(input.tarefaAtual!)
        );
    }

    private gerarSecaoComentarios(tarefa: TarefaCompleta): string {
        let commentsSection = '';
        if (tarefa.comments && tarefa.comments.length > 0) {
            commentsSection = '\n\n=== COMENTÁRIOS DA TAREFA ===\n';
            tarefa.comments.forEach((comment: any, index: number) => {
                const userInfo = comment.user ? `${comment.user.name} (${comment.user.nickname})` : 'Usuário';
                const timestamp = new Date(comment.createdAt).toLocaleString('pt-BR');
                commentsSection += `\n${index + 1}. [${timestamp}] ${userInfo}: ${comment.content}`;
            });
        }
        return commentsSection;
    }
}

export default PassoArquiteto;
