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
    const { message, stack, url, userAgent, type, line, col, ...meta } = req.body;

    // Criamos o erro e fazemos um cast para a nossa interface customizada
    const frontError = new FrontendError(message, meta);
    frontError.stack = stack || 'Stack não disponível';
    
    frontError.frontEndMeta = { url, userAgent, type, line, col };

    // Responde ao frontend rapidamente
    res.status(200).json({ success: true, message: 'Erro registrado' });

    // Cria a tarefa de forma assíncrona
    autoTaskService.createAutoTask(frontError, req, res)
      .then(result => {
        if (result?.success) {
          // Nova tarefa criada (duplicidade detectada automaticamente)
          console.log(`✅ Tarefa do front criada: ${result.task.id} (repetição detectada)`);
        } else if (result?.reason === 'duplicate_detected') {
          // Duplicidade detectada - processo continuará rodando
          console.log(`⚠️  Tarefa já existe para este erro: ${result.existingTaskId}. Processo continuará rodando.`);
        } else {
          // Falha na criação
          console.log(`❌ Falha na criação de tarefa: ${result?.reason || 'erro desconhecido'}`);
        }
      })
      .catch((err: Error) => {
        console.error('Erro fatal ao criar tarefa do front:', err.message);
      });

  } catch (error) {
    console.error('Falha ao processar erro do frontend:', error);
    res.status(500).json({ error: 'Erro interno ao registrar erro do front' });
  }
});

class FrontendError extends Error implements FrontendAnnotatedError {
  frontEndMeta: FrontendAnnotatedError['frontEndMeta'];
  
  constructor(message: string, meta: FrontendAnnotatedError['frontEndMeta']) {
    super(`[FRONTEND] ${message}`);
    this.frontEndMeta = meta;
  }
}

export default router;