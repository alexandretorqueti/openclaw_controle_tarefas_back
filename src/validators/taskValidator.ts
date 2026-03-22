/**
 * Validador de tarefas
 */

export function validateTask(data: any): { valid: boolean; errors: string[]; data: any } {
  const errors: string[] = [];

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Título é obrigatório');
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  };
}

export function validateTaskUpdate(data: any, existingTask: any): { valid: boolean; errors: string[]; data: any } {
  const errors: string[] = [];

  if (data.title !== undefined && data.title !== null) {
    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push('Título deve ser uma string não vazia');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  };
}

export function validateTaskSearch(params: any): { valid: boolean; errors: string[]; data: any } {
  return {
    valid: true,
    errors: [],
    data: params
  };
}
