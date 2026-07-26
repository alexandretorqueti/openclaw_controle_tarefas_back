import { JSONSchema7 } from 'json-schema';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { PassoIAAbstrato } from '../passoIAAbstrato';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { ContextoExecucao, TarefaCompleta } from '../../interfaces';

const retornoArquiteto = z.object({
    planDetails: z.string().describe('O plano seguido para fazer a análise'),
    architectNotes: z.string().optional().describe('Notas adicionais, considerações de design ou avisos de arquitetura.'),
    isFullyImplemented: z.boolean().describe('Se a analise foi concluída com sucesso, marque como falso. Se você já ALTEROU os arquivos e IMPLEMENTOU a correção, marque como verdadeiro.'),
    success: z.boolean().describe('Indica se a análise e o plano foram gerados com sucesso.'),
    comments: z.array(z.string()).optional().describe('Comentarios adicionais'),
    analise_completa: z.string().optional().describe('Escreva aqui a sua análise completa, sem comentários ou anotações. Faça uma análise para que seja enviada ao programador.'),
});

export type ArquitetoOutput = z.infer<typeof retornoArquiteto>;
const ArquitetoSchema: JSONSchema7 = zodToJsonSchema(retornoArquiteto) as JSONSchema7;

export class PassoArquiteto extends PassoIAAbstrato<Readonly<ContextoExecucao>, ArquitetoOutput> {
    readonly nome: string = 'AnaliseEPlanejamentoArquiteto';
    protected readonly schema: JSONSchema7 = ArquitetoSchema;

    protected getResultadoFallback(mensagemErro: string): ArquitetoOutput {
        return {
            planDetails: '',
            isFullyImplemented: false,
            success: false,
            analise_completa: '',
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
