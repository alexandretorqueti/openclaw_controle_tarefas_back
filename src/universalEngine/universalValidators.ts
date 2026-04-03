import { ContextoExecucaoMotorIA } from "./interfaces/interfaceMonitor";
import { ExpectedOutcome, JsonSchema, ValidationResult } from "./interfaces/interfaceUniversalAgentEngine";

export class UniversalValidators {
    constructor() {
        
    }
    
    public defaultValidateJSON(rawOutput: string, outcome: ExpectedOutcome): ValidationResult {
        try {
            let cleanString = rawOutput.trim();
            if (cleanString.startsWith('```')) {
                cleanString = cleanString.replace(/^```(json)?/, '').replace(/```$/, '').trim();
            }

            const parsed = JSON.parse(cleanString);
            
            // ✨ NOVO: Validador Genérico Padrão baseado no Schema
            if (outcome.schema) {
                const schemaError = this.validateAgainstSchema(parsed, outcome.schema);
                if (schemaError !== true) {
                    return { isValid: false, feedbackParaIA: schemaError };
                }
            }
            
            return { isValid: true, parsedData: parsed };
        } catch (e: any) {
            return { 
                isValid: false, 
                feedbackParaIA: `O JSON fornecido é inválido. Erro de sintaxe: ${e.message}.`
            };
        }
    }

    // O "Inspetor" de Contratos
    private validateAgainstSchema(parsedData: any, schema: JsonSchema): true | string {
        if (typeof parsedData !== 'object' || Array.isArray(parsedData) || parsedData === null) {
            return "A resposta deve ser um objeto JSON na raiz ({ ... }).";
        }

        // 1. Verifica propriedades obrigatórias
        if (schema.required) {
            for (const req of schema.required) {
                if (!(req in parsedData)) {
                    return `O JSON não obedece à assinatura. Faltou a propriedade obrigatória '${req}'.`;
                }
            }
        }

        // 2. Verifica os tipos das propriedades (Validação rasa)
        if (schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                if (key in parsedData) {
                    const value = parsedData[key];
                    if (propSchema.type === 'array' && !Array.isArray(value)) {
                        return `A propriedade '${key}' deve ser um array ([]).`;
                    }
                    if (propSchema.type !== 'array' && typeof value !== propSchema.type) {
                        return `A propriedade '${key}' deve ser do tipo '${propSchema.type}', mas você enviou '${typeof value}'.`;
                    }
                }
            }
        }

        return true;
    }

    public async defaultValidateFileCreation(rawOutput: string, ctx: ContextoExecucaoMotorIA, targetFile?: string): Promise<ValidationResult> {
        return { isValid: true, parsedData: { fileCreated: targetFile } };
    }

}