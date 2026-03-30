// monitor/utils/debugContexto.ts
// ─────────────────────────────────────────────────────
// Salva o contexto de execução em arquivo para debug.
// Usa injeção de dependência para FileSystem.
// ─────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import type { ContextoExecucao } from '../interfaces';
import { formatarJsonParaDebug } from './formatacao';

export interface ConfiguracaoDebug {
  diretorioBase: string;
}

export async function salvarContextoParaDebug(
  contexto: ContextoExecucao,
  nomePasso: string,
  config: ConfiguracaoDebug
): Promise<void> {
  const diretorioDebug = path.join(config.diretorioBase, 'contexto-debug');

  try {
    await fs.promises.mkdir(diretorioDebug, { recursive: true });

    const caminhoCompleto = path.join(diretorioDebug, 'debug.json');
    const dataHora = new Date().toISOString().replace(/[:.]/g, '-');

    const conteudo = {
      passo: nomePasso,
      timestamp: dataHora,
      contexto,
    };

    await fs.promises.writeFile(
      caminhoCompleto,
      formatarJsonParaDebug(conteudo),
      'utf-8'
    );
  } catch {
    // Debug nunca deve derrubar o sistema
  }
}
