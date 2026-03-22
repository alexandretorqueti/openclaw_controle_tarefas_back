/**
 * Arquivo de inicialização que registra todas as dependências reais do
 * sistema no container.
 */
import container from './container';

// Serviços reais da aplicação
import OpenClawService from './services/openclawService';
import PromptFactory from './utils/promptFactory';
import SessionChainUtils from './utils/sessionChainUtils';
import JsonUtils from './utils/jsonUtils';
import TaskService from './services/taskService';
import DecompositionService from './services/decompositionService';
import CommentService from './services/commentService';
import LockService from './services/lockService';
import MonitorStateService from './services/monitorStateService';
import TaskFileService from './services/taskFileService';
import FileUtils from './utils/fileUtils';
import TimeUtils from './utils/timeUtils';
import PrismaService from './services/prismaService';
import TaskAnalysisService from './services/taskAnalysisService';
import WorkspaceSnapshotService from './services/workspaceSnapshotService';
import SmartFileFinder from './utils/smartFileFinder';
import ContractVerificationService from './services/contractVerificationService';
import EvidenceService from './services/evidenceService';
import AgentService from './services/agentService';
import ProjectService from './services/projectService';
import LlmService from './services/llmService';
import TaskExecutionService from './services/taskExecutionService';
import TaskExecutionOrchestrator from './steps/TaskExecutionOrchestrator';
import { log } from '../aux/logger';
import config from '../aux/config';
import fs from 'fs/promises';
import * as axios from 'axios';
import * as path from 'path';

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
container.register('prisma', PrismaService);
container.register('taskAnalysisService', TaskAnalysisService);
container.register('workspaceSnapshotService', WorkspaceSnapshotService);
container.register('smartFileFinder', SmartFileFinder);
container.register('contractVerificationService', ContractVerificationService);
container.register('evidenceService', EvidenceService);
container.register('agentService', AgentService);
container.register('projectService', ProjectService);
container.register('llmService', LlmService);
container.register('taskExecutionService', TaskExecutionService);

// Serviços que precisam ser instanciados com configuração
container.register('LockServiceClass', LockService);
container.register('MonitorStateServiceClass', MonitorStateService);
container.register('TaskFileServiceClass', TaskFileService);

export default container;
