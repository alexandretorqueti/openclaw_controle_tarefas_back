/**
 * 1. OLLAMA - TEXTO (Endpoint: /api/generate)
 * Usado quando você pede para o Ollama apenas completar um prompt direto.
 * O texto real fica escondido na propriedade `response`.
 */
export interface RetornoOllamaTexto {
  model: string;
  created_at?: string;
  response: string; // <--- O texto bruto (JSON sujo) está AQUI
  done: boolean;
  context?: number[]; // Array de tokens do histórico (opcional)
  total_duration?: number;
}

/**
 * 2. OLLAMA - OBJETO/CHAT (Endpoint: /api/chat)
 * Usado quando você envia um array de mensagens com "role" (system, user, assistant).
 * O texto real fica aninhado dentro do objeto `message.content`.
 */
export interface RetornoOllamaObjeto {
  model: string;
  created_at?: string;
  message: {
    role: "assistant" | "system" | "user";
    content: string; // <--- O texto bruto (JSON sujo) está AQUI
  };
  done: boolean;
  total_duration?: number;
}

/**
 * 2.5. OLLAMA - MODO OPENAI (Endpoint: /v1/chat/completions)
 * Caso você use a biblioteca oficial da OpenAI apontando para o seu Ollama local.
 * O texto real fica ainda mais fundo: `choices[0].message.content`.
 */
export interface RetornoOllamaOpenAI {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string; // <--- O texto bruto (JSON sujo) está AQUI
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 3. OPENCLAW - GATEWAY (Processo Spawnado)
 * Retorno unificado do Gateway do OpenClaw. Ele captura o que saiu no terminal.
 * O texto real fica sempre na raiz, na propriedade `content`.
 */
export interface RetornoOpenclaw {
  success: boolean;
  content: string; // <--- O texto bruto (JSON sujo) está AQUI
  raw?: {
    stdout: string; // Log completo do terminal
    stderr: string; // Log de erros do terminal
  };
  error?: string; // Preenchido caso success seja false
}