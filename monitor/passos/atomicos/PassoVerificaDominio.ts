// monitor/passos/atomicos/PassoVerificaDominio.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Valida se a tarefa possui domínio definido.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';

export interface VerificaDominioInput {
  tarefa: TarefaCompleta;
  userId: string | null;
  configFalha: ConfiguracaoFalha;
}

export interface VerificaDominioOutput {
  dominioValido: boolean;
}

export interface ConfiguracaoFalha {
  apiUrl: string;
  tasksDir: string;
  errorDir: string;
}

export interface GerenciadorFalhaTarefa {
  registrarFalha(
    tarefa: TarefaCompleta,
    erro: Error,
    userId: string | null,
    config: ConfiguracaoFalha
  ): Promise<void>;
}

export interface DependenciasVerificaDominio extends DependenciasBase {
  gerenciadorFalha: GerenciadorFalhaTarefa;
}

export class PassoVerificaDominio extends PassoBase<VerificaDominioInput, VerificaDominioOutput> {
  readonly nome = 'Verificação de Domínio';

  private readonly gerenciadorFalha: GerenciadorFalhaTarefa;

  constructor(deps: DependenciasVerificaDominio) {
    super(deps);
    this.gerenciadorFalha = deps.gerenciadorFalha;
  }

  protected async processar(input: VerificaDominioInput): Promise<VerificaDominioOutput> {
    const { tarefa, userId, configFalha } = input;

    if (tarefa.domain) {
      await this.logger.info(`✅ Verificação de domínio aprovada: ${tarefa.domain}.`);
      return { dominioValido: true };
    }

    const mensagemErro = 'A tarefa é atômica, mas não foi possível inferir seu domínio (IA não detectou).';
    await this.logger.erro(`❌ Tarefa [${tarefa.id}] sem domínio definido.`);

    try {
      await this.gerenciadorFalha.registrarFalha(
        tarefa,
        new Error(mensagemErro),
        userId,
        configFalha
      );
    } catch (cleanupError: unknown) {
      const msg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      await this.logger.erro(
        `⚠️ Falha na rotina de limpeza do erro de domínio: ${msg}`
      );
    }

    return { dominioValido: false };
  }
}
