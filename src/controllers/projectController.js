var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const projectService = require('../services/projectService');
const { validateProject, validateProjectUpdate } = require('../validators/projectValidator');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const { snakeToCamel } = require('../utils/caseConverter');
const prisma = require('../services/prismaService');
const UserResolver = require('../utils/userResolver');
class ProjectController {
    constructor() {
        // 2026-03-10: Frontend fix - buttons edit/delete now have priority over row click to tasks screen (no backend change needed)
        this.createProject = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            // Convert snake_case to camelCase if needed
            const body = snakeToCamel(req.body);
            // DEBUG: Log para verificar campos recebidos
            console.log('🔍 CREATE /api/projects - Campos recebidos:', JSON.stringify(body, null, 2));
            console.log('🔍 CREATE /api/projects - programadorContratado recebido:', body.programadorContratado);
            // Determine createdById: prefer authenticated user, otherwise use provided ID
            let createdById = body.createdById;
            if (req.user && req.user.id) {
                // Use authenticated user's ID (overrides any provided value)
                createdById = req.user.id;
            }
            else if (!createdById || createdById.trim() === '') {
                // No authenticated user and no provided ID - use default user
                try {
                    // Usar o helper UserResolver para obter ID do usuário padrão
                    const defaultUserId = yield UserResolver.getDefaultUserId();
                    if (defaultUserId) {
                        createdById = defaultUserId;
                        console.log(`Usando usuário padrão para criação de projeto: ${defaultUserId}`);
                    }
                    else {
                        // Se não houver usuários, retornar erro
                        const error = new Error('Nenhum usuário encontrado no sistema. É necessário criar um usuário primeiro.');
                        error.statusCode = 400;
                        throw error;
                    }
                }
                catch (error) {
                    console.error('Erro ao buscar usuário padrão:', error.message);
                    // Não usar mais ID fixo - retornar erro
                    const fallbackError = new Error('Não foi possível determinar o usuário para criar o projeto. Certifique-se de que existem usuários no sistema.');
                    fallbackError.statusCode = 400;
                    throw fallbackError;
                }
            }
            // Update body with determined createdById
            const validatedBody = Object.assign(Object.assign({}, body), { createdById });
            const validation = validateProject(validatedBody);
            if (!validation.success) {
                const error = new Error('Validation failed');
                error.name = 'ZodError';
                error.errors = validation.error.errors;
                error.statusCode = 400;
                throw error;
            }
            const project = yield projectService.createProject(validation.data);
            res.status(201).json({
                message: 'Project created successfully',
                project,
                correlationId: req.correlationId
            });
        }));
        // Get all projects
        this.getAllProjects = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { sort_by: sortBy, sort_order: sortOrder } = req.query;
            const options = {
                sortBy: sortBy || 'createdAt',
                sortOrder: sortOrder || 'desc'
            };
            const projects = yield projectService.getAllProjects(options);
            res.json({
                count: projects.length,
                projects,
                correlationId: req.correlationId
            });
        }));
        // Get project by ID
        this.getProjectById = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const project = yield projectService.getProjectById(id);
            if (!project) {
                const error = new Error('Project not found');
                error.statusCode = 404;
                throw error;
            }
            // DEBUG: Log para verificar campos retornados
            console.log('🔍 GET /api/projects/:id - Campos retornados:', Object.keys(project));
            console.log('🔍 GET /api/projects/:id - programadorContratado retornado:', project.programadorContratado);
            res.json({
                project,
                correlationId: req.correlationId
            });
        }));
        // Update project
        this.updateProject = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // Convert snake_case to camelCase if needed
            const body = snakeToCamel(req.body);
            // DEBUG: Log para verificar campos recebidos
            console.log('🔍 UPDATE /api/projects/:id - Campos recebidos:', JSON.stringify(body, null, 2));
            console.log('🔍 UPDATE /api/projects/:id - programadorContratado recebido:', body.programadorContratado);
            const validation = validateProjectUpdate(body);
            if (!validation.success) {
                const error = new Error('Validation failed');
                error.name = 'ZodError';
                error.errors = validation.error.errors;
                error.statusCode = 400;
                throw error;
            }
            const project = yield projectService.updateProject(id, validation.data);
            if (!project) {
                const error = new Error('Project not found');
                error.statusCode = 404;
                throw error;
            }
            res.json({
                message: 'Project updated successfully',
                project,
                correlationId: req.correlationId
            });
        }));
        // Delete project
        this.deleteProject = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // DEBUG: Log para verificar o ID recebido
            console.log('🔍 DELETE /api/projects/:id - ID recebido:', id);
            console.log('🔍 DELETE /api/projects/:id - Tipo do ID:', typeof id);
            console.log('🔍 DELETE /api/projects/:id - URL completa:', req.originalUrl);
            console.log('🔍 DELETE /api/projects/:id - Método:', req.method);
            // Validar se ID foi fornecido
            if (!id || id.trim() === '') {
                const error = new Error('Project ID is required');
                error.statusCode = 400;
                throw error;
            }
            // Validar formato UUID (opcional, mas recomendado)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                console.log('❌ DELETE /api/projects/:id - ID inválido (não é UUID):', id);
                const error = new Error('Invalid project ID format');
                error.statusCode = 400;
                throw error;
            }
            console.log('✅ DELETE /api/projects/:id - ID válido, chamando service...');
            const project = yield projectService.deleteProject(id);
            if (!project) {
                console.log('❌ DELETE /api/projects/:id - Projeto não encontrado:', id);
                const error = new Error(`Project with ID ${id} not found`);
                error.statusCode = 404;
                error.code = 'PROJECT_NOT_FOUND';
                throw error;
            }
            console.log('✅ DELETE /api/projects/:id - Projeto excluído com sucesso:', project.id);
            res.json({
                message: 'Project deleted successfully',
                project,
                correlationId: req.correlationId
            });
        }));
        // Get projects by user ID
        this.getProjectsByUserId = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params;
            const projects = yield projectService.getProjectsByUserId(userId);
            res.json({
                count: projects.length,
                projects,
                correlationId: req.correlationId
            });
        }));
        // Search projects
        this.searchProjects = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { q } = req.query;
            if (!q || q.trim() === '') {
                const error = new Error('Search query is required');
                error.statusCode = 400;
                throw error;
            }
            const projects = yield projectService.searchProjects(q.trim());
            res.json({
                count: projects.length,
                projects,
                correlationId: req.correlationId
            });
        }));
        // Get project statistics
        this.getProjectStatistics = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const statistics = yield projectService.getProjectStatistics();
            res.json({
                statistics,
                correlationId: req.correlationId
            });
        }));
        // Archive project
        this.archiveProject = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const project = yield projectService.archiveProject(id);
            if (!project) {
                const error = new Error('Project not found');
                error.statusCode = 404;
                throw error;
            }
            res.json({
                message: 'Project archived successfully',
                project,
                correlationId: req.correlationId
            });
        }));
        // Restore archived project
        this.restoreProject = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const project = yield projectService.restoreProject(id);
            if (!project) {
                const error = new Error('Project not found');
                error.statusCode = 404;
                throw error;
            }
            res.json({
                message: 'Project restored successfully',
                project,
                correlationId: req.correlationId
            });
        }));
        // Get archived projects
        this.getArchivedProjects = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const projects = yield projectService.getArchivedProjects();
            res.json({
                count: projects.length,
                projects,
                correlationId: req.correlationId
            });
        }));
    }
}
module.exports = new ProjectController();
