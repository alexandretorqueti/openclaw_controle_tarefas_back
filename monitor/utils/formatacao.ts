// monitor/utils/formatacao.ts
// ─────────────────────────────────────────────────────
// Funções utilitárias de formatação puras (sem efeitos colaterais).
// ─────────────────────────────────────────────────────

/**
 * Converte segundos em formato legível "Xm Ys".
 */
export function segundosParaMinutosSegundos(totalSegundos: number): string {
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = Math.floor(totalSegundos % 60);

  if (minutos === 0) return `${segundos}s`;
  return `${minutos}m ${segundos}s`;
}

/**
 * Serializa um objeto para JSON legível, truncando strings longas
 * para evitar poluição visual nos logs e arquivos de debug.
 */
export function formatarJsonParaDebug(
  obj: unknown,
  maxCaracteresPorString: number = 100
): string {
  const replacer = (_key: string, value: unknown): unknown => {
    if (typeof value === 'string' && value.length > maxCaracteresPorString) {
      return value.substring(0, maxCaracteresPorString) + '...';
    }
    return value;
  };

  let jsonString = JSON.stringify(obj, replacer, 2);

  // Quebras de linha extras entre objetos para legibilidade
  jsonString = jsonString.replace(/},\n\s*{/g, '},\n\n{');

  return jsonString;
}
