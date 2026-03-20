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
const LockService = require('./services/lockService');
const MonitorStateService = require('./services/monitorStateService');
const TaskFileService = require('./services/taskFileService');
const FileUtils = require('./utils/fileUtils');
const TimeUtils = require('./utils/timeUtils');
const { log } = require('../aux/logger'); // caminho relativo ao bootstrap
const config = require('../aux/config');
const fs = require('fs').promises;
const axios = require('axios');
const path = require('path');

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
container.register('axios', axios);
container.register('path', path);
container.register('fileUtils', FileUtils);
container.register('timeUtils', TimeUtils);

// Serviços que precisam ser instanciados com configuração
// Registramos as classes para que possam ser instanciadas quando necessário
container.register('LockServiceClass', LockService);
container.register('MonitorStateServiceClass', MonitorStateService);
container.register('TaskFileServiceClass', TaskFileService);

module.exports = container;