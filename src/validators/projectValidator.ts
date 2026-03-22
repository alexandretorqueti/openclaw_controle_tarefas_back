/**
 * Validador de projetos
 */

export function validateProject(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Nome do projeto é obrigatório');
  }

  if (data.description && typeof data.description !== 'string') {
    errors.push('Descrição deve ser uma string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateProjectUpdate(data: any, existingProject: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.name !== undefined && data.name !== null) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Nome deve ser uma string não vazia');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateProjectSearch(params: any): { valid: boolean; errors: string[] } {
  return {
    valid: true,
    errors: [],
  };
}
