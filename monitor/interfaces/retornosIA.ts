import z from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { JSONSchema7, JSONSchema7Type } from 'json-schema';
import { error } from "node:console";

const 
    retornoTipoDaTarefa 
    = z.object({
        taskType: z.enum(['analysis', 'development', 'automation']).describe('Tipo da tarefa'),
        expectedLayers: z.array(z.enum([
            'backend', 
            'frontend']))
            .optional()
            .describe('Camadas esperadas'),
        difficult: z.number().min(0).max(100).default(0).describe('Dificuldade da tarefa'),
        success: z.boolean().describe('Indica se a tarefa foi analisada com sucesso'),
        motivos_camadas: z.string().describe('Diga claramente porque excolheu backend ou frontend como camadas.'),
        motivos_tipo: z.string().describe('Diga claramente porque excolheu analysis, development ou automation como o tipo da tarefa.')
    });

export type retornoTipoDaTarefaType = z.infer<typeof retornoTipoDaTarefa>;
export const retornoTipoDaTarefaSchema: JSONSchema7 = zodToJsonSchema(retornoTipoDaTarefa) as JSONSchema7;


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
export const VerificaAtomicidadeSchema: JSONSchema7 = zodToJsonSchema(retornoVerificaAtomicidade) as JSONSchema7;