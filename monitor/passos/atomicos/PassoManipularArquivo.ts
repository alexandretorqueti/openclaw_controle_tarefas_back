// monitor/passos/atomicos/PassoManipularArquivo.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Escrever e ler arquivos de disco de forma assíncrona.
// Usado intensamente pelo Arquiteto para gravar .mds de plano e relatórios.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';

export type AcaoArquivo = 'escrever' | 'ler' | 'apagar';

export interface ManipularArquivoInput {
  acao: AcaoArquivo;
  caminhoAbsoluto: string;
  conteudo?: string;
  criarPastas?: boolean;
}

export interface ManipularArquivoOutput {
  sucesso: boolean;
  conteudoLido?: string;
  mensagemErro?: string;
}

export interface ServicoDisco {
  escrever(caminho: string, conteudo: string, criar: boolean): Promise<void>;
  ler(caminho: string): Promise<string>;
  apagar(caminho: string): Promise<void>;
}

export interface DependenciasManipularArquivo extends DependenciasBase {
  disco: ServicoDisco;
}

export class PassoManipularArquivo extends PassoBase<ManipularArquivoInput, ManipularArquivoOutput> {
  readonly nome = 'Manipular Arquivo Disco';
  private readonly disco: ServicoDisco;

  constructor(deps: DependenciasManipularArquivo) {
    super(deps);
    this.disco = deps.disco;
  }

  protected async processar(input: ManipularArquivoInput): Promise<ManipularArquivoOutput> {
    try {
      if (input.acao === 'escrever') {
        await this.disco.escrever(input.caminhoAbsoluto, input.conteudo || '', input.criarPastas ?? true);
        await this.logger.info(`💾 Arquivo salvo em: ${input.caminhoAbsoluto}`);
        return { sucesso: true };
      }

      if (input.acao === 'ler') {
        const conteudo = await this.disco.ler(input.caminhoAbsoluto);
        await this.logger.info(`📖 Arquivo lido: ${input.caminhoAbsoluto}`);
        return { sucesso: true, conteudoLido: conteudo };
      }

      if (input.acao === 'apagar') {
        await this.disco.apagar(input.caminhoAbsoluto);
        await this.logger.info(`🗑️ Arquivo apagado: ${input.caminhoAbsoluto}`);
        return { sucesso: true };
      }

      throw new Error(`Ação não suportada: ${input.acao}`);
      
    } catch (error: unknown) {
      const erro = error instanceof Error ? error.message : String(error);
      await this.logger.erro(`💥 Falha na operação de disco [${input.acao}]: ${erro}`);
      return { sucesso: false, mensagemErro: erro };
    }
  }
}
