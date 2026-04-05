export enum LLMProvider {
    OLLAMA = 'OLLAMA',
    OPENCLAW = 'OPENCLAW'
}

export interface LLMResponse {
    success: boolean;
    content: string; // O que a IA respondeu
    error?: string;
    raw?: any;       // Objeto completo da resposta para debug
}

export interface LLMOptions {
    provider: LLMProvider;
    model?: string;
    agentId?: string;    // Obrigatório para OpenClaw
    sessionId?: string;
    temperature?: number;
    timeout: number;
    format?: string | object | undefined;
}

export interface EsquemaSimples {
  type?: string | string[];
  properties?: Record<string, EsquemaSimples>;
  items?: EsquemaSimples;
  description?: string;
  enum?: any[];
  [key: string]: any;
}