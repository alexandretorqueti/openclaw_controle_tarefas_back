import { config } from 'dotenv';

import { LLMOptions } from './interfaceLLM';
import { JSONSchema7 } from 'json-schema';
import { ContextoExecucao } from '../../../../src/interfaces/interfaceMonitor_old';
export type CustomValidator = (rawOutput: string, ctx: ContextoExecucao) => Promise<ValidationResult>;

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
    parsedData?: any;
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
    config: AIExecutionConfig,
    ctx: ContextoExecucao,
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