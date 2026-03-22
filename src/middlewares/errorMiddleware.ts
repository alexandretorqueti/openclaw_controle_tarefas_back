/**
 * Middleware para tratamento de erros customizados
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

/**
 * Tipos de erro para categorização
 */
export enum ERROR_TYPES {
  VALIDATION = 'VALIDATION',
  DATABASE = 'DATABASE',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  AUTH = 'AUTH',
  BUSINESS = 'BUSINESS',
  SYSTEM = 'SYSTEM',
}

/**
 * Extensão global do objeto Error para suportar propriedades customizadas de API
 */
declare global {
  interface Error {
    statusCode?: number;
    status?: number;
    errors?: any;
    code?: string | number;
    stderr?: string;
    validationErrors?: any;
    [key: string]: any;
  }
}

/**
 * Classe para gerenciamento centralizado de erros na aplicação
 */
export class ErrorMiddleware {
  /**
   * Método catchAsync para envolver funções assíncronas em try-catch
   */
  static catchAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Get the error type based on the error instance
   */
  static getErrorType(error: Error): ERROR_TYPES {
    if (error instanceof ZodError) {
      return ERROR_TYPES.VALIDATION;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return ERROR_TYPES.DATABASE;
    }
    if (error.code === 'P2002') return ERROR_TYPES.VALIDATION;
    if (error.code === 'P2025') return ERROR_TYPES.NOT_FOUND;
    
    if (error.statusCode === 404) return ERROR_TYPES.NOT_FOUND;
    if (error.statusCode === 403) return ERROR_TYPES.FORBIDDEN;
    if (error.statusCode === 401) return ERROR_TYPES.AUTH;
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return ERROR_TYPES.BUSINESS;
    }
    
    return ERROR_TYPES.SYSTEM;
  }

  /**
   * Get appropriate HTTP status code for the error
   */
  static getStatusCode(error: Error): number {
    if (error.statusCode) return error.statusCode;
    if (error.status) return error.status;
    if (error instanceof ZodError) return 400;
    
    // CORRIGIDO: Referência correta ao erro do Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return 400;
      if (error.code === 'P2025') return 404;
      return 400;
    }
    return 500;
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(error: Error, errorType: ERROR_TYPES): string {
    switch (errorType) {
      case ERROR_TYPES.VALIDATION:
        return 'Os dados informados são inválidos. Por favor, revise sua entrada.';
      case ERROR_TYPES.DATABASE:
        return 'Ocorreu um erro ao acessar o banco de dados. Tente novamente mais tarde.';
      case ERROR_TYPES.NOT_FOUND:
        return 'O recurso solicitado não foi encontrado.';
      case ERROR_TYPES.FORBIDDEN:
        return 'Você não tem permissão para acessar este recurso.';
      case ERROR_TYPES.AUTH:
        return 'Erro de autenticação. Por favor, faça login novamente.';
      case ERROR_TYPES.BUSINESS:
        return 'Erro de regra de negócios: ' + (error.message || '');
      default:
        return 'Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.';
    }
  }

  /**
   * Middleware de tratamento de erros genérico
   */
  static errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    // CORRIGIDO: Uso do nome da classe em vez de 'this' para evitar perda de contexto no Express
    const statusCode = err.statusCode || err.status || ErrorMiddleware.getStatusCode(err);
    const errorType = ErrorMiddleware.getErrorType(err);
    const message = err.message || ErrorMiddleware.getUserFriendlyMessage(err, errorType);

    res.status(statusCode).json({
      success: false,
      message,
      errors: err.errors || null,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  /**
   * Middleware de tratamento de erros de validação
   */
  static validationErrorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: err.validationErrors || null,
    });
  }
}


