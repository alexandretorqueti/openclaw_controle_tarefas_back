// monitor/passos/atomicos/PassoChamarIA.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Chama a LLM via API ou CLI (OpenClaw)
// Responsabilidade: Enviar prompt, aguardar e devolver a resposta.
// Não faz parse de JSON, não valida regra de negócio.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';

export interface ChamarIAInput {
  prompt: string;
  agente: string;
  timeoutMs: number | 60000;
  arquivosContexto?: string[]; // Arquivos a serem anexados
  sessionId?: string; // ID de sessão existente para continuar conversação
}

export interface ChamarIAOutput {
  sucesso: boolean;
  respostaRaw: string;
  rawOutput?: string;
  toolCall?: Record<string, any>;
  toolResult?: Record<string, any>;
  erro?: string;
}

export interface ServicoOpenClaw {
  executarTurno(input: ChamarIAInput): Promise<{ 
    sucesso: boolean; 
    output: string;
    rawOutput?: string;
    toolCall?: Record<string, any>;
    toolResult?: Record<string, any>;
  }>;
}

export interface DependenciasChamarIA extends DependenciasBase {
  openClaw: ServicoOpenClaw;
}

export class PassoChamarIA extends PassoBase<ChamarIAInput, ChamarIAOutput> {
  readonly nome = 'Chamar IA (OpenClaw)';
  private readonly openClaw: ServicoOpenClaw;

  constructor(deps: DependenciasChamarIA) {
    super(deps);
    this.openClaw = deps.openClaw;
  }

  protected async processar(input: ChamarIAInput): Promise<ChamarIAOutput> {
    await this.logger.info(`🤖 Invocando agente '${input.agente}'...`);

    try {
      const resultado = await this.openClaw.executarTurno(input);

      if (!resultado.sucesso) {
        return {
          sucesso: false,
          respostaRaw: '',
          erro: 'A IA falhou em completar a resposta ou sofreu timeout.',
        };
      }

      return {
        sucesso: true,
        respostaRaw: resultado.output,
        rawOutput: resultado.rawOutput,
        toolCall: resultado.toolCall,
        toolResult: resultado.toolResult,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        sucesso: false,
        respostaRaw: '',
        erro: `Erro na comunicação com o OpenClaw: ${msg}`,
      };
    }
  }
}
