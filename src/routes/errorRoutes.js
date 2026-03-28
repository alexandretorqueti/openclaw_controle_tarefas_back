"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const autoTaskService_1 = __importDefault(require("../services/autoTaskService"));
const router = (0, express_1.Router)();
// Rota GET para informar que apenas POST é suportado
router.get('/frontend-errors', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Método não permitido. Use POST para enviar erros do frontend.',
    allowedMethods: ['POST'],
    example: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        message: 'Erro de exemplo',
        stack: 'Error: exemplo\n    at ...',
        url: 'http://localhost:3000/page',
        userAgent: 'Mozilla/5.0 ...',
        type: 'Error',
        line: 10,
        col: 5
      }
    }
  });
});

// Passamos a nossa interface FrontendErrorBody para o Request do Express
router.post('/frontend-errors', async (req, res) => {
    try {
        const { message, stack, url, userAgent, type, line, col, ...meta } = req.body;
        // Criamos o erro e fazemos um cast para a nossa interface customizada
        const frontError = new FrontendError(message, meta);
        frontError.stack = stack || 'Stack não disponível';
        frontError.frontEndMeta = { url, userAgent, type, line, col };
        // Responde ao frontend rapidamente
        res.status(200).json({ success: true, message: 'Erro registrado' });
        // Cria a tarefa de forma assíncrona
        autoTaskService_1.default.createAutoTask(frontError, req, res)
            .then(result => {
            if (result?.success) {
                // Nova tarefa criada (duplicidade detectada automaticamente)
                console.log(`✅ Tarefa do front criada: ${result.task.id} (repetição detectada)`);
            }
            else if (result?.reason === 'duplicate_detected') {
                // Duplicidade detectada - processo continuará rodando
                console.log(`⚠️  Tarefa já existe para este erro: ${result.existingTaskId}. Processo continuará rodando.`);
            }
            else {
                // Falha na criação
                console.log(`❌ Falha na criação de tarefa: ${result?.reason || 'erro desconhecido'}`);
            }
        })
            .catch((err) => {
            console.error('Erro fatal ao criar tarefa do front:', err.message);
        });
    }
    catch (error) {
        console.error('Falha ao processar erro do frontend:', error);
        res.status(500).json({ error: 'Erro interno ao registrar erro do front' });
    }
});
class FrontendError extends Error {
    frontEndMeta;
    constructor(message, meta) {
        super(`[FRONTEND] ${message}`);
        this.frontEndMeta = meta;
    }
}
exports.default = router;
