const express = require('express');
const TaskExecutionController = require('../controllers/taskExecutionController');

const router = express.Router();


/**
 * @route GET /api/task-executions/log/:id
 * @description Obtém detalhes de um log específico
 * @access Private
 */
router.get('/log/:id', TaskExecutionController.getExecutionLog);

/**
 * @route GET /api/task-executions/stats/:taskId
 * @description Obtém estatísticas de execução de uma tarefa
 * @access Private
 */
router.get('/stats/:taskId', TaskExecutionController.getExecutionStats);

/**
 * @route GET /api/task-executions/:taskId
 * @description Lista logs de execução de uma tarefa específica
 * @access Private
 */
router.get('/:taskId', TaskExecutionController.getTaskExecutions);

module.exports = router;