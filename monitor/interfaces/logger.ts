// monitor/interfaces/logger.ts
// ─────────────────────────────────────────────────────
// Contrato do logger — desacopla o motor da implementação.
// ─────────────────────────────────────────────────────

export interface Logger {
  info(mensagem: string): Promise<void>;
  erro(mensagem: string): Promise<void>;
  debug(mensagem: string): Promise<void>;
}
