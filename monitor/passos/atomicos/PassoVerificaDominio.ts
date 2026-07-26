import { JSONSchema7 } from 'json-schema';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';
import { PassoIAAbstrato } from '../passoIAAbstrato';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { ContextoExecucao, TarefaCompleta } from '../../interfaces';

export interface ConfiguracaoFalha {
  apiUrl: string;
  tasksDir: string;
  errorDir: string;
}

export interface VerificaDominioInput {
  tarefa: TarefaCompleta;
  userId: string | null;
  configFalha: ConfiguracaoFalha;
}

export type DependenciasVerificaDominio = any;

const retornoDominioSchema = z.object({
    isIdeal: z.boolean().describe('Indica se a tarefa é atômica'),
    reason: z.string().describe('Explicação da análise'),
    confidence: z.number().describe('Nível de confiança de 0 a 100'),
    inferredDomain: z.enum(['backend', 'frontend', 'analysis']).describe('Domínio inferido pela IA')
});

export type VerificaDominioOutput = {
    dominioValido: boolean;
    dominio?: string;
};

const DominioJsonSchema: JSONSchema7 = zodToJsonSchema(retornoDominioSchema) as JSONSchema7;

export class PassoVerificaDominio extends PassoIAAbstrato<Readonly<ContextoExecucao>, any> {
    readonly nome = 'Verificação de Domínio';
    protected readonly schema: JSONSchema7 = DominioJsonSchema;

    protected getResultadoFallback(mensagemErro: string): VerificaDominioOutput {
        return { dominioValido: false };
    }

    protected async construirPrompt(input: ContextoExecucao): Promise<string> {
        return FabricaPromptsIA.buildTaskAnalysisPrompt(input.tarefaAtual, input.project);
    }

    async processar(input: ContextoExecucao): Promise<VerificaDominioOutput> {
        const { tarefaAtual, UserId, config } = input;

        if (tarefaAtual.domain && tarefaAtual.domain !== 'UNKNOWN') {
            await this.logger.info(`✅ Domínio já definido no banco: ${tarefaAtual.domain}`);
            return { dominioValido: true, dominio: tarefaAtual.domain };
        }

        const resultadoIA = await super.processar(input);

        if (!resultadoIA || resultadoIA.inferredDomain === 'UNKNOWN') {
            await this.logger.erro(`❌ Não foi possível determinar o domínio para a tarefa ${tarefaAtual.id}`);
            
            const deps = (this as any).deps;
            if (deps.gerenciadorFalha) {
                await deps.gerenciadorFalha.registrarFalha(
                    tarefaAtual, 
                    new Error('Domínio não identificado pela IA'), 
                    UserId, 
                    { 
                        apiUrl: config.API_URL, 
                        tasksDir: config.TASKS_DIR, 
                        errorDir: config.ERROR_DIR 
                    }
                );
            }
            return { dominioValido: false };
        }

        return { 
            dominioValido: true, 
            dominio: resultadoIA.inferredDomain 
        };
    }
}

export default PassoVerificaDominio;
