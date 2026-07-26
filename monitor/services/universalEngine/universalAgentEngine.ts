import { log } from '../../../src/aux/logger';
import { AIExecutionConfig, ValidationResult, OutcomeType, Sugestao, ConteudoAI } from './interfaces/interfaceUniversalAgentEngine';
import { UniversalValidators } from './universalValidators';
import { LLMService } from './services/llmService';
import { executeWithValidationLoopArgs } from './interfaces/interfaceUniversalAgentEngine';
import fs from 'fs/promises';
import { RetornoOpenclaw } from './interfaces/interfaceRestostasIA';


// ============================================================================
// 2. O MOTOR UNIVERSAL
// ============================================================================
export interface UniversalAgentEngineDeps {
    fileSystem: any;
}


export class UniversalAgentEngine {
    private deps : UniversalAgentEngineDeps;
    private universalValidators : UniversalValidators;
    private readonly llmService = new LLMService();

    constructor(deps: UniversalAgentEngineDeps) {
        this.deps = deps;
        this.universalValidators = new UniversalValidators(deps);
    } 
    public async executeWithValidationLoop<T = any>  (
        { configIA: config, llmOptions } : executeWithValidationLoopArgs
    ): Promise<ValidationResult> { 
        
        const retries = config.maxRetries || 3;
        let tentativaAtual = 1;
        let promptAtual = config.userPrompt;
        let promptSistema = config.systemPrompt;

        // ✨ A MÁGICA DA COESÃO: Injeção automática do Schema no Prompt!
        

        while (tentativaAtual <= retries) {
            await log(`🔄 [Motor Universal] Iniciando tentativa ${tentativaAtual}/${retries} para agente: ${config.agentId}`);

            try {
                // 1. CHAMA A IA
                const response: RetornoOpenclaw = await this.llmService
                    .execute(promptAtual, promptSistema, llmOptions, config.expectedOutcomes); 
                
                if (!response.success) {
                    await log(`💥 [Motor Universal] Erro na execução da IA: ${response.error}`);
                    throw new Error(response.error);
                }
                
                // 2. VALIDA A RESPOSTA
                const validation = await this.validateResponse(response.content, config);

                // 3. DECISÃO
                if (validation.isValid) {
                    await log(`✅ [Motor Universal] Resposta validada com sucesso na tentativa ${tentativaAtual}!`);
                    
                    return {
                        isValid: true,
                        parsedData: validation.parsedData  || response.raw,
                    } as ValidationResult
                }

                // 4. PREPARA O LOOP DE BRONCA
                await log(`⚠️ [Motor Universal] Validação falhou. Motivo:\n${validation.feedbackParaIA}`);
                promptAtual = `Sua resposta anterior foi rejeitada.\n\n${validation.feedbackParaIA}\n\nPor favor, corrija os erros na estrutura do JSON e tente novamente obedecendo ao contrato.`;
                try {
                    await fs.writeFile('/home/alexandrebragatorqueti/logllm.txt', 
                        `
                        ${ promptAtual }\n\n
                        
                        ${JSON.stringify(validation.parsedData || response.raw).split('\\n').join('\n')}
                        
                        `, 'utf8'); 
                } catch (error) {
                    
                }

                tentativaAtual++;

            } catch (error: any) {
                await log(`💥 [Motor Universal] Erro fatal na execução: ${error.message}`);
                try {
                    await fs.writeFile('/home/alexandrebragatorqueti/logllm.txt', `💥 [Motor Universal] Erro fatal na execução: ${JSON.stringify(error)}`, 'utf8'); 
                } catch (error) {
                    
                }
                throw error; 
            }
        }

        const erroMsg = `[Motor Universal] Abortando: O agente falhou em gerar uma saída válida após ${retries} tentativas.`;
        await log(`❌ ${erroMsg}`);
        throw new Error(erroMsg);
    }

    private extractJSONFromMarkdown(text: string): string {
        // Busca qualquer coisa entre ```json e ```
        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            return match[1]; // Retorna apenas o miolo limpinho
        }
        // Se não achar o bloco markdown, tenta retornar o texto original (pode ser que já seja um JSON puro)
        return text;
    }

    // ============================================================================
    // 3. ROTEADOR DE VALIDAÇÕES
    // ============================================================================

    private async validateResponse(
        content: string, 
        config: AIExecutionConfig
    ): Promise<ValidationResult> {
        
        let allValid = true;
        const feedbacks: string[] = [];
        let combinedParsedData: any = {}; 

        for (const outcome of config.expectedOutcomes) {
            let result: ValidationResult;

            switch (outcome.type) {
                case OutcomeType.CUSTOM:
                    if (!outcome.customValidator) throw new Error("Validador CUSTOM exigido, mas nenhuma função foi fornecida.");
                    result = await outcome.customValidator(content);
                    break;
                case OutcomeType.JSON:
                    // Limpa a sujeira antes de tentar validar!
                    const jsonLimpo = this.extractJSONFromMarkdown(content);
                    result = this.universalValidators.defaultValidateJSON(jsonLimpo, outcome);
                    break;
                case OutcomeType.FILE_CREATION:
                    result = await this.universalValidators.defaultValidateFileCreation(content, outcome.targetFile);
                    break;
                case OutcomeType.ANY:
                    result = { isValid: true, parsedData: { rawOutput: content } };
                    break;
                default:
                    result = { isValid: false, feedbackParaIA: `Validador ${outcome.type} não implementado.` };
            }

            if (!result.isValid) {
                allValid = false;
                if (result.feedbackParaIA) feedbacks.push(`- Falha em ${outcome.type}: ${result.feedbackParaIA}`);
            } else if (result.parsedData) {
                combinedParsedData = result.parsedData ;
            }
        }

        if (!allValid) {
            return {
                isValid: false,
                feedbackParaIA: `Sua resposta falhou nos seguintes requisitos:\n${feedbacks.join('\n')}`
            } as ValidationResult;
        }

        return { isValid: true, parsedData: combinedParsedData } as ValidationResult;
    }
  
}