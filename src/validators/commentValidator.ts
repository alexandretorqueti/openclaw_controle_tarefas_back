/**
 * Validador de comentários
 */

export function validateComment(data: any, agentId?: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
    errors.push('Conteúdo do comentário é obrigatório');
  }

  if (!agentId) {
    errors.push('Agent ID é obrigatório');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCommentUpdate(data: any, existingComment: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.content !== undefined && data.content !== null) {
    if (typeof data.content !== 'string' || data.content.trim().length === 0) {
      errors.push('Conteúdo deve ser uma string não vazia');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCommentSearch(params: any): { valid: boolean; errors: string[] } {
  return {
    valid: true,
    errors: [],
  };
}
