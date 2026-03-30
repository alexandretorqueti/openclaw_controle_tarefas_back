// monitor/passos/PassoBase.ts
// ─────────────────────────────────────────────────────
// Template Method Pattern com Generics.
//
// Todo passo herda de PassoBase<TInput, TOutput>.
// O esqueleto (log, métricas, tratamento de erro) fica
// trancado aqui. O filho só implementa `processar()`.
// ─────────────────────────────────────────────────────

import type { Logger } from '../interfaces/logger';

export interface DependenciasBase {
  logger: Logger;
}

/**
 * Classe abstrata que define o contrato e o ciclo de vida
 * de qualquer passo do motor de monitoramento.
 *
 * @template TInput  - Tipo dos dados que o passo recebe
 * @template TOutput - Tipo dos dados que o passo devolve
 */
export abstract class PassoBase<TInput, TOutput> {
  /** Nome legível do passo (usado em logs e no catálogo) */
  abstract readonly nome: string;

  protected readonly logger: Logger;

  constructor(deps: DependenciasBase) {
    this.logger = deps.logger;
  }

  /**
   * Método público — o "esqueleto" que ninguém sobrescreve.
   * Cuida de logging, métricas e tratamento de erro.
   */
  public async execute(input: TInput): Promise<TOutput> {
    const inicio = Date.now();

    await this.logger.info(`▶️  Iniciando passo: ${this.nome}`);

    try {
      const resultado = await this.processar(input);
      const duracaoMs = Date.now() - inicio;

      await this.logger.info(
        `✅ Passo "${this.nome}" concluído em ${duracaoMs}ms`
      );

      return resultado;
    } catch (erro: unknown) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      await this.logger.erro(
        `💥 Erro no passo "${this.nome}": ${mensagem}`
      );
      throw erro;
    }
  }

  /**
   * Método protegido que cada passo concreto DEVE implementar.
   * Recebe dados tipados, devolve resultado tipado.
   */
  protected abstract processar(input: TInput): Promise<TOutput>;
}
