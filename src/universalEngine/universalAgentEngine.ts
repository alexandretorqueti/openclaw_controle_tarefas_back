import { log } from '../aux/logger';
import { ContextoExecucaoMotorIA } from './interfaces/interfaceMonitor';
import { AIExecutionConfig, ValidationResult, OutcomeType, ExpectedOutcome, JsonSchema, CustomValidator } from './interfaces/interfaceUniversalAgentEngine';
import { UniversalValidators } from './universalValidators';
import { LLMService } from './services/llmService';
import { LLMResponse } from './interfaces/interfaceLLM';
import { executeWithValidationLoopArgs } from './interfaces/interfaceUniversalAgentEngine';
// ============================================================================
// 1. CONTRATOS (Interfaces)
// ============================================================================



// ============================================================================
// 2. O MOTOR UNIVERSAL
// ============================================================================

export class UniversalAgentEngine {
    private readonly universalValidators = new UniversalValidators();
    private readonly llmService = new LLMService();
    public async executeWithValidationLoop(
        { config, ctx, llmOptions } : executeWithValidationLoopArgs
    ): Promise<any> { 
        
        const retries = config.maxRetries || 3;
        let tentativaAtual = 1;
        let promptAtual = config.userPrompt;

        // ✨ A MÁGICA DA COESÃO: Injeção automática do Schema no Prompt!
        for (const outcome of config.expectedOutcomes) {
            if (outcome.type === OutcomeType.JSON && outcome.schema) {
                const schemaString = JSON.stringify(outcome.schema, null, 2);
                promptAtual += `\n\n[INSTRUÇÃO DE SISTEMA AUTOMÁTICA]\nSua resposta DEVE ser estritamente um JSON que obedeça à seguinte estrutura de dados:\n\`\`\`json\n${schemaString}\n\`\`\`\nNão inclua explicações fora do JSON.`;
            }
        }

        while (tentativaAtual <= retries) {
            await log(`🔄 [Motor Universal] Iniciando tentativa ${tentativaAtual}/${retries} para agente: ${config.agentId}`);

            try {
                // 1. CHAMA A IA
                const rawOutput: LLMResponse = await this.llmService.execute(promptAtual, llmOptions); 
                
                if (!rawOutput.success) {
                    await log(`💥 [Motor Universal] Erro na execução da IA: ${rawOutput.error}`);
                    throw new Error(rawOutput.error);
                }

                // 2. VALIDA A RESPOSTA
                const validation = await this.validateResponse(rawOutput.raw, config, ctx);

                // 3. DECISÃO
                if (validation.isValid) {
                    await log(`✅ [Motor Universal] Resposta validada com sucesso na tentativa ${tentativaAtual}!`);
                    return validation.parsedData || rawOutput;
                }

                // 4. PREPARA O LOOP DE BRONCA
                await log(`⚠️ [Motor Universal] Validação falhou. Motivo:\n${validation.feedbackParaIA}`);
                
                promptAtual = `Sua resposta anterior foi rejeitada.\n\n${validation.feedbackParaIA}\n\nPor favor, corrija os erros na estrutura do JSON e tente novamente obedecendo ao contrato.`;
                tentativaAtual++;

            } catch (error: any) {
                await log(`💥 [Motor Universal] Erro fatal na execução: ${error.message}`);
                throw error; 
            }
        }

        const erroMsg = `[Motor Universal] Abortando: O agente falhou em gerar uma saída válida após ${retries} tentativas.`;
        await log(`❌ ${erroMsg}`);
        
        ctx.shouldAbort = true;
        ctx.abortReason = erroMsg;
        throw new Error(erroMsg);
    }

    // ============================================================================
    // 3. ROTEADOR DE VALIDAÇÕES
    // ============================================================================
    
    private async validateResponse(
        rawOutput: any, 
        config: AIExecutionConfig, 
        ctx: ContextoExecucaoMotorIA
    ): Promise<ValidationResult> {
        
        let allValid = true;
        const feedbacks: string[] = [];
        let combinedParsedData: any = {}; 

        for (const outcome of config.expectedOutcomes) {
            let result: ValidationResult;

            switch (outcome.type) {
                case OutcomeType.CUSTOM:
                    if (!outcome.customValidator) throw new Error("Validador CUSTOM exigido, mas nenhuma função foi fornecida.");
                    result = await outcome.customValidator(rawOutput.model, ctx);
                    break;
                case OutcomeType.JSON:
                    result = this.universalValidators.defaultValidateJSON(rawOutput.model, outcome);
                    break;
                case OutcomeType.FILE_CREATION:
                    result = await this.universalValidators.defaultValidateFileCreation(rawOutput.model, ctx, outcome.targetFile);
                    break;
                case OutcomeType.ANY:
                    result = { isValid: true, parsedData: { rawOutput: rawOutput.model } };
                    break;
                default:
                    result = { isValid: false, feedbackParaIA: `Validador ${outcome.type} não implementado.` };
            }

            if (!result.isValid) {
                allValid = false;
                if (result.feedbackParaIA) feedbacks.push(`- Falha em ${outcome.type}: ${result.feedbackParaIA}`);
            } else if (result.parsedData) {
                combinedParsedData = { ...combinedParsedData, ...result.parsedData };
            }
        }

        if (!allValid) {
            return {
                isValid: false,
                feedbackParaIA: `Sua resposta falhou nos seguintes requisitos:\n${feedbacks.join('\n')}`
            };
        }

        return { isValid: true, parsedData: combinedParsedData };
    }
  
}