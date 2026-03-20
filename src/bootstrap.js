// src/bootstrap.js
/**
 * Arquivo de inicialização que registra todas as dependências reais do
 * sistema no container. Deve ser executado antes de qualquer código que
 * dependa do container (por exemplo, no início de monitor.js ou em testes).
 */
const container = require('./container');

// Serviços reais da aplicação
const OpenClawService = require('./services/openclawService');
const PromptFactory = require('./utils/promptFactory');
const SessionChainUtils = require('./utils/sessionChainUtils');
const JsonUtils = require('./utils/jsonUtils');
const TaskService = require('./services/taskService');
const DecompositionService = require('./services/decompositionService');
const CommentService = require('./services/commentService');
const { log } = require('../aux/logger'); // caminho relativo ao bootstrap
const config = require('../aux/config');
const fs = require('fs').promises;

// Registra as dependências
container.register('openClawService', OpenClawService);
container.register('promptFactory', PromptFactory);
container.register('sessionChainUtils', SessionChainUtils);
container.register('jsonUtils', JsonUtils);
container.register('taskService', TaskService);
container.register('decompositionService', DecompositionService);
container.register('commentService', CommentService);
container.register('log', log);
container.register('config', config);
container.register('fileSystem', fs);

module.exports = container;