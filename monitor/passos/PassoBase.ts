// monitor/passos/PassoBase.ts
// ─────────────────────────────────────────────────────
// Template Method Pattern com Generics (Input/Output).
//
// O passo PURO. Não conhece o ContextoExecucao.
// Recebe uma entrada estrita, devolve uma saída estrita.
// ─────────────────────────────────────────────────────

import type { Logger } from '../interfaces/logger';

export interface DependenciasBase {
  logger: Logger;
}

/**
 * Classe abstrata que define o contrato e o ciclo de vida
 * da lógica de negócio de um passo.
 *
 * @template TInput  - Tipo dos dados que o passo recebe
 * @template TOutput - Tipo dos dados que o passo devolve
 */
export abstract class PassoBase<TInput, TOutput> {
  abstract readonly nome: string;
  protected readonly logger: Logger;

  constructor(deps: DependenciasBase) {
    this.logger = deps.logger;
  }

  /**
   * O "esqueleto" público (fechado para modificação).
   * Cuida de logging, métricas e tratamento de erro.
   */
  public async execute(input: TInput): Promise<TOutput> {
    const inicio = Date.now();
    await this.logger.info(`▶️  Iniciando processamento: ${this.nome}`);

    try {
      const resultado = await this.processar(input);
      const duracaoMs = Date.now() - inicio;

      await this.logger.info(
        `✅ Processamento "${this.nome}" concluído em ${duracaoMs}ms`
      );

      return resultado;
    } catch (erro: unknown) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      await this.logger.erro(
        `💥 Falha no processamento "${this.nome}": ${mensagem}`
      );
      throw erro; // Repassa o erro para o Wrapper/Motor lidar
    }
  }

  /**
   * Método protegido que cada passo concreto DEVE implementar.
   * Onde a mágica (IA, banco, regras) acontece.
   */
  protected abstract processar(input: TInput): Promise<TOutput>;
}

