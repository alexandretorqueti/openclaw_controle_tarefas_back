// monitor/passos/atomicos/PassoVerificaDominio.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Valida e determina o domínio da tarefa.
// Se a tarefa não tem domínio, chama LLM com modelo auxiliar para determinar.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { TarefaCompleta, FabricaPrompts } from '../../interfaces';

export interface VerificaDominioInput {
  tarefa: TarefaCompleta;
  userId: string | null;
  configFalha: ConfiguracaoFalha;
}

export interface VerificaDominioOutput {
  dominioValido: boolean;
  dominio?: string; // 'backend' ou 'frontend'
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

/** Contrato do serviço LLM com modelo auxiliar */
export interface ServicoLlmAuxiliar {
  determinarDominioTarefa(
    titulo: string,
    descricao: string,
    contextoProjeto: any,
    prompt: string
  ): Promise<'BACKEND' | 'FRONTEND' | 'UNKNOWN'>;
}

export interface DependenciasVerificaDominio extends DependenciasBase {
  gerenciadorFalha: GerenciadorFalhaTarefa;
  servicoLlmAuxiliar?: ServicoLlmAuxiliar;
  fabricaPrompts?: FabricaPrompts;
}

export interface ResultadoCheckDominio {
  isIdeal: boolean,
  reason: string,
  confidence: number,
  inferredDomain: string | null;
}

export class PassoVerificaDominio extends PassoBase<VerificaDominioInput, VerificaDominioOutput> {
  readonly nome = 'Verificação de Domínio';

  private readonly gerenciadorFalha: GerenciadorFalhaTarefa;
  private readonly servicoLlmAuxiliar?: ServicoLlmAuxiliar;
  private readonly fabricaPrompts?: FabricaPrompts;

  constructor(deps: DependenciasVerificaDominio) {
    super(deps);
    this.gerenciadorFalha = deps.gerenciadorFalha;
    this.servicoLlmAuxiliar = deps.servicoLlmAuxiliar;
    this.fabricaPrompts = deps.fabricaPrompts;
  }

  protected async processar(input: VerificaDominioInput): Promise<VerificaDominioOutput> {
    const { tarefa, userId, configFalha } = input;

    // CASO 1: Tarefa já tem domínio definido
    if (tarefa.domain) {
      await this.logger.info(`✅ Verificação de domínio aprovada: ${tarefa.domain}.`);
      return { dominioValido: true, dominio: tarefa.domain };
    }

    // CASO 2: Tarefa não tem domínio, mas temos serviço LLM auxiliar
    if (this.servicoLlmAuxiliar && this.fabricaPrompts) {
      await this.logger.info(`🔍 Tarefa sem domínio. Chamando LLM auxiliar para determinar...`);

      try {
        // Gerar prompt para determinar domínio
        const promptDominio = this.fabricaPrompts.gerarPromptParaVerificarAtomicidadeeDominio(tarefa);

        // Chamar LLM auxiliar
        const dominioDeterminado : string = await this.servicoLlmAuxiliar.determinarDominioTarefa(
          tarefa.title,
          tarefa.description || '',
          tarefa.project,
          promptDominio
        );

        if (dominioDeterminado === 'UNKNOWN') {
          await this.logger.erro(`❌ LLM não conseguiu determinar domínio para tarefa [${tarefa.id}].`);
          await this.registrarFalhaDominio(tarefa, userId, configFalha);
          return { dominioValido: false };
        }

        await this.logger.info(`✅ Domínio determinado pela LLM: ${dominioDeterminado}`);
        return { dominioValido: true, dominio: dominioDeterminado };

      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        await this.logger.erro(`❌ Erro ao chamar LLM para determinar domínio: ${msg}`);
        await this.registrarFalhaDominio(tarefa, userId, configFalha);
        return { dominioValido: false };
      }
    }

    // CASO 3: Tarefa sem domínio e sem serviço LLM disponível
    await this.logger.erro(`❌ Tarefa [${tarefa.id}] sem domínio definido e sem LLM auxiliar disponível.`);
    await this.registrarFalhaDominio(tarefa, userId, configFalha);
    return { dominioValido: false };
  }

  private async registrarFalhaDominio(
    tarefa: TarefaCompleta,
    userId: string | null,
    configFalha: ConfiguracaoFalha
  ): Promise<void> {
    const mensagemErro = 'A tarefa é atômica, mas não foi possível inferir seu domínio (IA não detectou).';
    
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
  }
}
