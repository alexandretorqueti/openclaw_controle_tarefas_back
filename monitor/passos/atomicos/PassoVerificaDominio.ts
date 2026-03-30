// monitor/passos/atomicos/PassoVerificaDominio.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Valida se a tarefa possui domínio definido.
//
// Se não tiver, é um erro de negócio fatal, e o passo já
// aciona a rotina de falha (mover para erro, atualizar API).
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import type { Passo, ContextoExecucao, TarefaCompleta } from '../../interfaces';
import { StepName } from '../../interfaces';

export interface ConfiguracaoFalha {
  apiUrl: string;
  tasksDir: string;
  errorDir: string;
}

/** Contrato do serviço que processa falhas (atualiza API e move pastas) */
export interface GerenciadorFalhaTarefa {
  registrarFalha(
    tarefa: TarefaCompleta,
    erro: Error,
    userId: string | null,
    config: ConfiguracaoFalha
  ): Promise<void>;
}

export interface DependenciasVerificaDominio {
  logger: Logger;
  gerenciadorFalha: GerenciadorFalhaTarefa;
}

export class PassoVerificaDominio implements Passo {
  readonly name = StepName.VERIFICA_DOMINIO;

  private readonly logger: Logger;
  private readonly gerenciadorFalha: GerenciadorFalhaTarefa;

  constructor(deps: DependenciasVerificaDominio) {
    this.logger = deps.logger;
    this.gerenciadorFalha = deps.gerenciadorFalha;
  }

  async executar(ctx: ContextoExecucao): Promise<void> {
    const tarefa = ctx.tarefaAtual;
    if (!tarefa) return;

    if (tarefa.domain) {
      await this.logger.info(`✅ Verificação de domínio aprovada: ${tarefa.domain}.`);
      return;
    }

    // Fluxo de erro: Tarefa atômica mas sem domínio (frontend/backend/etc)
    const mensagemErro = 'A tarefa é atômica, mas não foi possível inferir seu domínio (IA não detectou).';
    await this.logger.erro(`❌ Tarefa [${tarefa.id}] sem domínio definido.`);

    try {
      await this.gerenciadorFalha.registrarFalha(
        tarefa,
        new Error(mensagemErro),
        ctx.UserId,
        {
          apiUrl: ctx.config.API_URL,
          tasksDir: ctx.config.TASKS_DIR,
          errorDir: ctx.config.ERROR_DIR,
        }
      );
    } catch (cleanupError: unknown) {
      const msg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      await this.logger.erro(
        `⚠️ Falha na rotina de limpeza do erro de domínio: ${msg}`
      );
    } finally {
      // Efeito Colateral Explícito no namespace de erros
      ctx.erros.dominio = true;
    }
  }
}
