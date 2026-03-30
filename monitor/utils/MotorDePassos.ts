// monitor/utils/MotorDePassos.ts
// ─────────────────────────────────────────────────────
// Motor genérico que navega pelo mapa de transições,
// executando passos e resolvendo a próxima rota.
//
// Responsabilidades:
//   1. Manter o catálogo de passos registrados
//   2. Resolver a próxima rota a partir do mapa
//   3. Executar o ciclo até chegar em `null`
// ─────────────────────────────────────────────────────

import type { Passo, ContextoExecucao, MapaDeTransicoes, Rota, StepName } from '../interfaces';
import type { Logger } from '../interfaces/logger';

export interface ConfiguracaoMotor {
  logger: Logger;
  mapaDeTransicoes: MapaDeTransicoes;
}

export class MotorDePassos {
  private readonly catalogo: Map<StepName, Passo> = new Map();
  private readonly mapa: MapaDeTransicoes;
  private readonly logger: Logger;

  constructor(config: ConfiguracaoMotor) {
    this.mapa = config.mapaDeTransicoes;
    this.logger = config.logger;
  }

  /** Registra um passo no catálogo */
  registrar(passo: Passo): void {
    if (this.catalogo.has(passo.name)) {
      throw new Error(
        `Passo "${passo.name}" já registrado. Nomes devem ser únicos.`
      );
    }
    this.catalogo.set(passo.name, passo);
  }

  /** Registra múltiplos passos de uma vez */
  registrarTodos(passos: Passo[]): void {
    for (const passo of passos) {
      this.registrar(passo);
    }
  }

  /**
   * Executa o ciclo completo a partir de um passo inicial.
   * Retorna a lista de passos executados (útil para debug/testes).
   */
  async executar(
    passoInicial: StepName,
    contexto: ContextoExecucao
  ): Promise<string[]> {
    const passosExecutados: string[] = [];
    let passoAtualNome: StepName | null = passoInicial;

    while (passoAtualNome !== null) {
      const passo = this.catalogo.get(passoAtualNome);

      if (!passo) {
        await this.logger.erro(
          `⚠️ ERRO CRÍTICO: Passo "${passoAtualNome}" não encontrado no catálogo!`
        );
        break;
      }

      // 1. Executa a lógica do passo
      await passo.executar(contexto);
      passosExecutados.push(passoAtualNome);

      // 2. Resolve o próximo destino
      passoAtualNome = this.resolverProximoDestino(passoAtualNome, contexto);
    }

    return passosExecutados;
  }

  /**
   * Avalia as rotas disponíveis para o passo atual e devolve
   * o nome do próximo passo (ou null se o ciclo terminou).
   */
  private resolverProximoDestino(
    passoAtual: StepName,
    contexto: ContextoExecucao
  ): StepName | null {
    const rotas: Rota[] | undefined = this.mapa[passoAtual];

    if (!rotas || rotas.length === 0) {
      return null; // Passo terminal — sem rotas definidas
    }

    // A primeira rota cuja condição retorne true (ou sem condição = fallback)
    const rotaEscolhida = rotas.find(
      (rota) => !rota.condition || rota.condition(contexto)
    );

    if (!rotaEscolhida) {
      this.logger.erro(
        `⚠️ Nenhuma condição de rota atendida em "${passoAtual}".`
      );
      return null;
    }

    return rotaEscolhida.to;
  }

  /** Retorna os nomes de todos os passos registrados (útil para validação) */
  passosRegistrados(): StepName[] {
    return Array.from(this.catalogo.keys());
  }
}
