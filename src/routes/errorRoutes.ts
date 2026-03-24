import { Router, Request, Response } from 'express';
// Assumindo que você já converteu esses arquivos, ou pelo menos importou os tipos corretamente
import autoTaskService from '../services/autoTaskService'; 
import { Logger, ERROR_TYPES } from '../utils/logger';

const router = Router();

// 1. Definimos o que exatamente o frontend vai nos enviar
export interface FrontendErrorBody {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  type: string;
  line?: number;
  col?: number;
}

// 2. Estendemos a classe Error nativa para incluir nossos metadados customizados
export interface FrontendAnnotatedError extends Error {
  frontEndMeta?: {
    url: string;
    userAgent: string;
    type: string;
    line?: number;
    col?: number;
  };
}

// Passamos a nossa interface FrontendErrorBody para o Request do Express
router.post('/frontend-errors', async (
  req: Request<{}, {}, FrontendErrorBody>, 
  res: Response
): Promise<void> => {
  try {
    const { message, stack, url, userAgent, type, line, col } = req.body;

    // Criamos o erro e fazemos um cast para a nossa interface customizada
    const frontError = new Error(`[FRONTEND] ${message}`) as FrontendAnnotatedError;
    frontError.stack = stack || 'Stack não disponível';
    
    frontError.frontEndMeta = { url, userAgent, type, line, col };

    // Responde ao frontend rapidamente
    res.status(200).json({ success: true, message: 'Erro registrado' });

    // Cria a tarefa de forma assíncrona
    autoTaskService.createAutoTask(frontError, req, res)
      .then(task => {
        if (task) console.log(`Tarefa do front criada: ${task.id}`);
      })
      .catch((err: Error) => {
        console.error('Erro ao criar tarefa do front:', err.message);
      });

  } catch (error) {
    console.error('Falha ao processar erro do frontend:', error);
    res.status(500).json({ error: 'Erro interno ao registrar erro do front' });
  }
});

export default router;