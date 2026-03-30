// monitor/passos/atomicos/PassoExtrairValidarJSON.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Tenta encontrar um bloco JSON dentro de texto
// bruto gerado pela IA, extrai e valida com Zod ou estrutura esperada.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';

export interface ExtrairJSONInput {
  textoBruto: string;
}

export interface ExtrairJSONOutput<T> {
  sucesso: boolean;
  dados: T | null;
  erroDeSintaxe?: string;
}

export interface FabricaJSONValidator<T> {
  parsear(texto: string): T;
}

export interface DependenciasExtrairJSON<T> extends DependenciasBase {
  validador: FabricaJSONValidator<T>;
}

export class PassoExtrairValidarJSON<T> extends PassoBase<ExtrairJSONInput, ExtrairJSONOutput<T>> {
  readonly nome = 'Extrair e Validar JSON';
  private readonly validador: FabricaJSONValidator<T>;

  constructor(deps: DependenciasExtrairJSON<T>) {
    super(deps);
    this.validador = deps.validador;
  }

  protected async processar(input: ExtrairJSONInput): Promise<ExtrairJSONOutput<T>> {
    const regex = /```json\s*([\s\S]*?)\s*```/;
    const match = regex.exec(input.textoBruto);

    const jsonString = match ? match[1] : input.textoBruto;

    try {
      const objeto = this.validador.parsear(jsonString);
      await this.logger.info(`✅ JSON extraído e validado.`);
      
      return {
        sucesso: true,
        dados: objeto,
      };
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : String(error);
      await this.logger.info(`⚠️ Erro ao tentar processar o JSON: ${mensagem}`);
      
      return {
        sucesso: false,
        dados: null,
        erroDeSintaxe: `Sintaxe JSON ou Esquema inválidos: ${mensagem}`,
      };
    }
  }
}
