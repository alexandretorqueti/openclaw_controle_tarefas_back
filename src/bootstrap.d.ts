/**
 * Arquivo de inicialização que registra todas as dependências reais do
 * sistema no container. Deve ser executado antes de qualquer código que
 * dependa do container (por exemplo, no início de monitor.js ou em testes).
 */
declare const container: any;
declare const OpenClawService: any;
declare const PromptFactory: any;
declare const SessionChainUtils: any;
declare const JsonUtils: any;
declare const TaskService: any;
declare const DecompositionService: any;
declare const CommentService: any;
declare const LockService: any;
declare const MonitorStateService: any;
declare const TaskFileService: any;
declare const FileUtils: any;
declare const TimeUtils: any;
declare const PrismaService: any;
declare const TaskAnalysisService: any;
declare const WorkspaceSnapshotService: any;
declare const SmartFileFinder: any;
declare const ContractVerificationService: any;
declare const EvidenceService: any;
declare const AgentService: any;
declare const ProjectService: any;
declare const LlmService: any;
declare const TaskExecutionService: any;
declare const TaskExecutionOrchestrator: any;
declare const log: any;
declare const config: any;
declare const fs: any;
declare const axios: any;
declare const path: any;
