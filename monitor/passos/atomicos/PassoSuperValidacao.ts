// monitor/passos/atomicos/PassoSuperValidacao.ts
// ─────────────────────────────────────────────────────
// Passos: SuperValidacao — Validações críticas pós-inicialização.
// Contrato do modelo: Passo<TarefaCompleta>
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import type { Passo } from '../../interfaces';
import { StepName } from '../../interfaces';
import type { ContextoExecucao, TarefaCompleta, PlanoDeAnalise } from '../../interfaces';

/**
 * Passo: SuperValidacao
 *
 * Responsabilidades:
 *   1. Validar que todos os campos obrigatórios da tarefa existem
 *   2. Validar que o projeto é válido
 *   3. Executar análise preliminar da tarefa
 *   4. Gerar plano de implementação
 *
 * Condição de saída:
 *   - Se falhar: erroFatalIA = true, para no passo
 *   - Se sucesso: continua para Decomposição
 */
export class PassoSuperValidacao implements Passo {
  readonly name = StepName.VALIDA_TAREFA;

  private readonly logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
  }

  async executar(ctx: ContextoExecucao): Promise<void> {
    const logPrefix = `[${this.name}]`;

    // 1. Validação de campos obrigatórios
    const camposObrigatorios = ['id', 'title', 'description', 'statusId', 'projectId'];
    for (const campo of camposObrigatorios) {
      if (!(campo in (ctx.tarefaAtual as any))) {
        await this.logger.erro(
          `${logPrefix} Campo obrigatório faltando: ${campo} na tarefa ${ctx.tarefaAtual?.id}`
        );
        ctx.controleExecucao.erroFatalIA = true;
        return;
      }
    }

    // 2. Validação do projeto
    if (!ctx.tarefaAtual?.project) {
      await this.logger.erro(
        `${logPrefix} Projeto não é válido para tarefa ${ctx.tarefaAtual?.id}`
      );
      ctx.controleExecucao.erroFatalIA = true;
      return;
    }

    // 3. Análise preliminar da tarefa
    if (ctx.services.taskAnalysisService) {
      const plano = await ctx.services.taskAnalysisService.analyze(
        ctx.tarefaAtual as TarefaCompleta
      );
      ctx.analysisPlan = plano as PlanoDeAnalise;

      await this.logger.info(
        `${logPrefix} ✅ Análise concluída para tarefa ${ctx.tarefaAtual?.id}`
      );
    }

    // 4. Preparação para decomposição
    ctx.controleExecucao.loopsExecutados++;
  }
}
