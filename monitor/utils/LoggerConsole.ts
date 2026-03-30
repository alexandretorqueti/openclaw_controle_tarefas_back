// monitor/utils/LoggerConsole.ts
// ─────────────────────────────────────────────────────
// Implementação concreta do Logger que escreve no stderr
// e em arquivo rotativo (compat com o logger legado).
// ─────────────────────────────────────────────────────

import * as fs from 'fs';
import type { Logger } from '../interfaces/logger';

export interface ConfiguracaoLogger {
  caminhoArquivo: string;
  maxLinhas: number;
}

export class LoggerConsole implements Logger {
  private readonly caminhoArquivo: string;
  private readonly maxLinhas: number;

  constructor(config: ConfiguracaoLogger) {
    this.caminhoArquivo = config.caminhoArquivo;
    this.maxLinhas = config.maxLinhas;
  }

  async info(mensagem: string): Promise<void> {
    await this.escrever('INFO', mensagem);
  }

  async erro(mensagem: string): Promise<void> {
    await this.escrever('ERRO', mensagem);
  }

  async debug(mensagem: string): Promise<void> {
    await this.escrever('DEBUG', mensagem);
  }

  private async escrever(nivel: string, mensagem: string): Promise<void> {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    const linhaFormatada = `[${timestamp}] [${nivel}] ${mensagem}`;

    // Saída imediata no stderr (não polui stdout para JSON do OpenClaw)
    console.error(linhaFormatada);

    // Persistência em arquivo com rotação
    try {
      await this.persistirEmArquivo(linhaFormatada);
    } catch {
      // Falha de I/O no log nunca deve derrubar o sistema
    }
  }

  private async persistirEmArquivo(linha: string): Promise<void> {
    let linhasExistentes: string[] = [];

    try {
      await fs.promises.access(this.caminhoArquivo, fs.constants.F_OK);
      const conteudo = await fs.promises.readFile(this.caminhoArquivo, 'utf8');
      linhasExistentes = conteudo.split('\n').filter((l) => l.trim() !== '');
    } catch {
      // Arquivo não existe ainda — tudo bem
    }

    // Inserção no topo (mais recente primeiro, igual ao logger legado)
    linhasExistentes.unshift(linha);

    // Rotação: mantém apenas as N mais recentes
    if (linhasExistentes.length > this.maxLinhas) {
      linhasExistentes = linhasExistentes.slice(0, this.maxLinhas);
    }

    await fs.promises.writeFile(
      this.caminhoArquivo,
      linhasExistentes.join('\n') + '\n',
      'utf8'
    );
  }
}
