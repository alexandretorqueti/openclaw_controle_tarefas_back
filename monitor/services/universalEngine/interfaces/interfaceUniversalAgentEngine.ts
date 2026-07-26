import { config } from 'dotenv';

import { LLMOptions } from './interfaceLLM';
import { JSONSchema7 } from 'json-schema';
import { ContextoExecucao } from '../../../interfaces/tipos';
export type CustomValidator = (rawOutput: string) => Promise<ValidationResult>;

// ✨ NOVO: Representação de Interface em tempo de execução
export interface JsonSchema {
    type: 'object';
    properties: {
        [key: string]: {
            type: 'string' | 'number' | 'boolean' | 'array' | 'object';
            description?: string;
        }
    };
    required?: string[];
}

export interface ValidationResult {
    isValid: boolean;
    feedbackParaIA?: string;
    parsedData?: object;
}

export enum OutcomeType {
    JSON = 'JSON',
    FILE_CREATION = 'FILE_CREATION',
    CUSTOM = 'CUSTOM',
    ANY = 'ANY'
}

export interface ExpectedOutcome {
    type: OutcomeType;
    targetFile?: string;
    customValidator?: CustomValidator;
    
    // ✨ NOVO: Substituímos a função manual por um Schema descritivo
    schema?: JSONSchema7;
}

export interface AIExecutionConfig {
    agentId: string;
    systemPrompt: string;
    userPrompt: string;
    expectedOutcomes: ExpectedOutcome[]; 
    maxRetries?: number;
}

export interface executeWithValidationLoopArgs {
    configIA: AIExecutionConfig,
    llmOptions?: LLMOptions
}

export interface Sugestao {
  atividade: string;
  detalhes: string;
}

export interface ConteudoAI {
  message: string;
  sugestoes: Sugestao[];
}