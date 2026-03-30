// monitor/passos/macro/FaseFinaliza.ts
// ─────────────────────────────────────────────────────
// Macro Passo: FASE FINALIZAÇÃO
// O orquestrador usa isso após o código ser aprovado ou testes falharem.
// Solta o lock, escreve logs na Tarefa e marca o status.
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';

export interface FinalizacaoInput {
  tarefaAtual: TarefaCompleta;
  novoStatus: string;
  mensagemFechamento: string;
}

export interface FinalizacaoOutput {
  sucesso: boolean;
}

/** Contrato mínimo para o cliente HTTP da API */
export interface ClienteApiFinalizacao {
  buscarStatusPorNome(apiUrl: string, nome: string): Promise<{ id: number } | null>;
  atualizarStatusTarefa(apiUrl: string, taskId: number | string, statusId: number): Promise<void>;
  adicionarComentarioTarefa(apiUrl: string, taskId: number | string, autorId: string, texto: string): Promise<void>;
}

export interface DependenciasFinalizacao {
  logger: Logger;
  clienteApi: ClienteApiFinalizacao;
  apiUrl: string;
  userId: string | null;
}

export class MacroFaseFinalizacao extends PassoBase<FinalizacaoInput, FinalizacaoOutput> {
  readonly nome = 'Fase de Finalização (Cleanup e API)';
  private readonly clienteApi: ClienteApiFinalizacao;
  private readonly apiUrl: string;
  private readonly userId: string | null;

  constructor(deps: DependenciasFinalizacao) {
    super(deps);
    this.clienteApi = deps.clienteApi;
    this.apiUrl = deps.apiUrl;
    this.userId = deps.userId;
  }

  protected async processar(input: FinalizacaoInput): Promise<FinalizacaoOutput> {
    await this.logger.info(`🏁 Finalizando tarefa [${input.tarefaAtual.id}]...`);

    // 1. Atualizar Status na API
    try {
      const status = await this.clienteApi.buscarStatusPorNome(this.apiUrl, input.novoStatus);
      if (status) {
        await this.clienteApi.atualizarStatusTarefa(this.apiUrl, input.tarefaAtual.id, status.id);
        await this.logger.info(`✅ Tarefa movida para o status "${input.novoStatus}".`);
      } else {
        await this.logger.erro(`⚠️ Status "${input.novoStatus}" não existe no banco da API.`);
      }
    } catch (err: unknown) {
      await this.logger.erro(`💥 Erro ao atualizar status na API: ${String(err)}`);
    }

    // 2. Adicionar o comentário final (Relatório da IA)
    if (this.userId && input.mensagemFechamento) {
      try {
        await this.clienteApi.adicionarComentarioTarefa(
          this.apiUrl,
          input.tarefaAtual.id,
          this.userId,
          input.mensagemFechamento
        );
        await this.logger.info(`💬 Relatório final enviado para os comentários da tarefa.`);
      } catch (err: unknown) {
        await this.logger.erro(`💥 Erro ao adicionar comentário de fechamento: ${String(err)}`);
      }
    }

    return { sucesso: true };
  }
}
