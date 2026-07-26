import { JSONSchema7 } from 'json-schema';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { ContextoExecucao } from '../../interfaces';
import { PassoIAAbstrato } from '../passoIAAbstrato';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';

const retornoProgramador = z.object({
    sucesso: z.boolean().describe('Indica se a implementação do código foi finalizada com sucesso e os testes/builds parecem estar corretos.'),
    mensagem: z.string().describe('Mensagem explicando o que foi codificado ou detalhando por que falhou.'),
    arquivosModificados: z.array(z.string()).describe('Lista com os caminhos dos arquivos que foram criados, editados ou removidos.'),
    precisaDeMaisTurnos: z.boolean().optional().describe('Marque como verdadeiro apenas se a complexidade for extrema e você não conseguiu finalizar a tarefa no tempo previsto. Caso contrário, finalize tudo o que for possível.'),
});

export type ProgramadorOutput = z.infer<typeof retornoProgramador>;
const ProgramadorSchema: JSONSchema7 = zodToJsonSchema(retornoProgramador) as JSONSchema7;

export class PassoProgramador extends PassoIAAbstrato<Readonly<ContextoExecucao>, ProgramadorOutput> {
    readonly nome: string = 'FaseProgramador';
    protected readonly schema: JSONSchema7 = ProgramadorSchema;

    protected getResultadoFallback(mensagemErro: string): ProgramadorOutput {
        return {
            sucesso: false,
            mensagem: mensagemErro,
            arquivosModificados: [],
            precisaDeMaisTurnos: false
        };
    }

    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        let planoArquiteto = `
        Análise do Arquiteto: ${input.resultados?.arquiteto?.analise_completa}
        `;
        
        let prompt = FabricaPromptsIA.gerarPromptProgramador(
            input.tarefaAtual!,
            planoArquiteto
        );

        return prompt;
    }
}

export default PassoProgramador;
