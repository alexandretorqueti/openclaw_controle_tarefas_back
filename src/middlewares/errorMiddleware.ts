/**
 * Middleware para tratamento de erros customizados
 */

import { Request, Response, NextFunction } from 'express';

// Extensão global do objeto Error para suportar propriedades customizadas de API
declare global {
  interface Error {
    statusCode?: number;
    errors?: any;
    code?: string | number;
    stderr?: string;
    validationErrors?: any;
  }
}

// Middleware global de tratamento de erros
export function errorHandler(
  err: Error & { statusCode?: number; errors?: any },
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || null,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function validationErrorHandler(
  err: Error & { validationErrors?: any },
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.status(400).json({
    success: false,
    message: 'Erro de validação',
    errors: err.validationErrors || null,
  });
}
