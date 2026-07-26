import { JSONSchema7 } from 'json-schema';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { ContextoExecucao } from '../../interfaces';
import { PassoIAAbstrato } from '../passoIAAbstrato';
import { MacroFaseInspecaoWorkspace } from '../macro/FaseInspecaoWorkspace';

export const retryableFailures: [string, ...string[]] = ['SEM_ALTERACOES', 'ALTERACOES_INSUFICIENTES', 'ERRO_DE_SINTAXE', 'NAO_SEGUIU_O_PLANO', 'OUTRO', 'NADA_FEITO', 'BUILD_FALHOU', 'TESTES_FALHARAM'];

const retornoAnaliseProgramador = z.object({
    workspaceValidado: z.boolean().describe('Verdadeiro se o código do programador atende aos requisitos, os arquivos certos foram criados e a sintaxe aparenta estar correta.'),
    precisaCorrecao: z.boolean().describe('Verdadeiro se o programador cometeu erros evidentes, não entregou o que foi pedido, ou causou regressões.'),
    tipoFalha: z.enum(retryableFailures).optional().describe('Classificação da falha, se houver.'),
    mensagemCorrecao: z.string().describe('Mensagem detalhada para o programador explicando exatamente o que ele precisa corrigir na próxima tentativa.'),
    notasInspecao: z.string().describe('Notas internas do analista sobre a qualidade do código (não enviadas ao programador).')
});

export type AnaliseProgramadorOutput = z.infer<typeof retornoAnaliseProgramador>;
const AnaliseProgramadorSchema: JSONSchema7 = zodToJsonSchema(retornoAnaliseProgramador) as JSONSchema7;

export class PassoAnaliseProgramador extends PassoIAAbstrato<Readonly<ContextoExecucao>, AnaliseProgramadorOutput> {
    readonly nome: string = 'FaseAnaliseProgramador';
    protected readonly schema: JSONSchema7 = AnaliseProgramadorSchema;

    protected getResultadoFallback(mensagemErro: string): AnaliseProgramadorOutput {
        return {
            workspaceValidado: false,
            precisaCorrecao: true,
            tipoFalha: 'OUTRO',
            mensagemCorrecao: mensagemErro,
            notasInspecao: 'Falha crítica na inspeção do workspace.'
        };
    }

    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        // Precisamos dos resultados da inspeção do workspace para compor este prompt
        const inspecao = input.resultados?.inspecaoWorkspace;
        
        if (!inspecao) {
            throw new Error('A inspeção do workspace deve ser executada antes da análise do programador.');
        }

        const task = input.tarefaAtual!;
        const project = input.project!;
        const plano = input.resultados?.arquiteto?.planDetails || task.description;

        return `
Você é o Revisor de Código Senior.
Sua missão é avaliar o trabalho do Desenvolvedor comparando o que ele fez com o Plano Original.

[A TAREFA ORIGINAL]
Título: ${task.title}
Domínio: ${task.domain}
Descrição: ${task.description}

[O PLANO QUE O DESENVOLVEDOR DEVERIA SEGUIR]
${plano}

[RELATÓRIO DO SISTEMA DE ARQUIVOS (O QUE REALMENTE ACONTECEU)]
- Arquivo .done criado? ${inspecao.existsDoneFile ? 'SIM' : 'NÃO'}
- Houve alterações reais no código? ${inspecao.hasRealChanges ? 'SIM' : 'NÃO'}
- Arquivos Criados: ${inspecao.fileChanges.created.length > 0 ? inspecao.fileChanges.created.join(', ') : 'Nenhum'}
- Arquivos Modificados: ${inspecao.fileChanges.modified.length > 0 ? inspecao.fileChanges.modified.join(', ') : 'Nenhum'}
- Arquivos Deletados: ${inspecao.fileChanges.deleted.length > 0 ? inspecao.fileChanges.deleted.join(', ') : 'Nenhum'}

[MENSAGEM DO DESENVOLVEDOR]
${input.resultados?.programador?.mensagem || 'Sem mensagem do desenvolvedor.'}

REGRAS DE AVALIAÇÃO:
1. FATOS ACIMA DE TUDO: Se o relatório de arquivos diz que não houve alterações, O DESENVOLVEDOR MENTIU. Reprove imediatamente (workspaceValidado: false).
2. CONFORMIDADE: Os arquivos alterados correspondem ao que o Arquiteto pediu no plano? Se o plano pediu pra editar X e ele editou Y, reprove.

Se reprovar, escreva uma 'mensagemCorrecao' dura e direta instruindo o que ele DEVE consertar.
Se aprovar, 'mensagemCorrecao' pode ser um elogio simples.
`;
    }
}

export default PassoAnaliseProgramador;
