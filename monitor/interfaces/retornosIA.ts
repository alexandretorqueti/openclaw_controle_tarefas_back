import z from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { JSONSchema7, JSONSchema7Type } from 'json-schema';

const 
    retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacao 
    = z.object({
        taskType: z.enum(['analysis', 'development', 'automation']).describe('Tipo da tarefa'),
        expectedLayers: z.array(z.enum([
            'backend', 
            'frontend']))
            .optional()
            .describe('Camadas esperadas'),
        difficult: z.number().min(0).max(100).default(0).describe('Dificuldade da tarefa'),
        error: z.string().optional().describe('Erro detectado na tarefa'),
        success: z.boolean().describe('Indica se a tarefa foi analisada com sucesso')
    });

export type retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoType = z.infer<typeof retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacao>;
export const retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacaoSchema: JSONSchema7 = zodToJsonSchema(retornoAnalisaTarefaParaDefinirSeEDesenvolvimentoAnaliseOuAutomacao) as JSONSchema7;