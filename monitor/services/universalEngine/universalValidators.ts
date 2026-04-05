import { JSONSchema7 } from "json-schema";
import { ExpectedOutcome, JsonSchema, ValidationResult } from "./interfaces/interfaceUniversalAgentEngine";
import { ContextoExecucao } from "../../interfaces";

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
    private validateAgainstSchema(parsedData: any, schema: JSONSchema7): true | string {
        // 1. Validação de Nulo
        if (parsedData === null || parsedData === undefined) {
            return "O dado fornecido está vazio ou é nulo.";
        }

        // 2. Lógica para ARRAYS
        if (schema.type === 'array') {
            if (!Array.isArray(parsedData)) {
                return `Esperado um array, mas recebeu '${typeof parsedData}'.`;
            }

            // Se houver definição de itens, validamos cada um deles
            if (schema.items) {
                for (let i = 0; i < parsedData.length; i++) {
                    // Chamada recursiva: valida cada item do array contra o schema de itens
                    const itemResult = this.validateAgainstSchema(parsedData[i], schema.items as JSONSchema7);
                    if (itemResult !== true) {
                        return `Erro no item [${i}]: ${itemResult}`;
                    }
                }
            }
            return true;
        }

        // 3. Lógica para OBJETOS
        if (schema.type === 'object') {
            if (typeof parsedData !== 'object' || Array.isArray(parsedData)) {
                return `Esperado um objeto, mas recebeu '${Array.isArray(parsedData) ? 'array' : typeof parsedData}'.`;
            }

            // Verifica propriedades obrigatórias
            if (schema.required) {
                for (const req of schema.required) {
                    if (!(req in parsedData)) {
                        return `Faltou a propriedade obrigatória '${req}'.`;
                    }
                }
            }

            // Verifica os tipos das propriedades (Recursivo para objetos aninhados)
            if (schema.properties) {
                for (const [key, propSchema] of Object.entries(schema.properties)) {
                    if (key in parsedData) {
                        const res = this.validateAgainstSchema(parsedData[key], propSchema as JSONSchema7);
                        if (res !== true) return `Na chave '${key}': ${res}`;
                    }
                }
            }
            return true;
        }

        // 4. Validação de Tipos Primitivos (Backup)
        const actualType = Array.isArray(parsedData) ? 'array' : typeof parsedData;
        if (schema.type && schema.type !== actualType) {
            return `Tipo inválido. Esperado '${schema.type}', mas recebeu '${actualType}'.`;
        }

        return true;
    }

    public async defaultValidateFileCreation(rawOutput: string, ctx: ContextoExecucao, targetFile?: string): Promise<ValidationResult> {
        return { isValid: true, parsedData: { fileCreated: targetFile } };
    }

}