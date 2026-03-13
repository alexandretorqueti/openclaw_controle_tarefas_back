const projectService = require('../services/projectService');
const { validateProject, validateProjectUpdate } = require('../validators/projectValidator');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const { snakeToCamel } = require('../utils/caseConverter');
const prisma = require('../services/prismaService');
const UserResolver = require('../utils/userResolver');
class ProjectController {  // FIX 2026-03-10: Frontend buttons edit/delete projects have priority - no backend change
  // 2026-03-10: Frontend fix - buttons edit/delete now have priority over row click to tasks screen (no backend change needed)
  createProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    // Determine createdById: prefer authenticated user, otherwise use provided ID
    let createdById = body.createdById;
    
    if (req.user && req.user.id) {
      // Use authenticated user's ID (overrides any provided value)
      createdById = req.user.id;
    } else if (!createdById || createdById.trim() === '') {
      // No authenticated user and no provided ID - use default user
      try {
        // Usar o helper UserResolver para obter ID do usuário padrão
        const defaultUserId = await UserResolver.getDefaultUserId();
        
        if (defaultUserId) {
          createdById = defaultUserId;
          console.log(`Usando usuário padrão para criação de projeto: ${defaultUserId}`);
        } else {
          // Se não houver usuários, retornar erro
          const error = new Error('Nenhum usuário encontrado no sistema. É necessário criar um usuário primeiro.');
          error.statusCode = 400;
          throw error;
        }
      } catch (error) {
        console.error('Erro ao buscar usuário padrão:', error.message);
        // Não usar mais ID fixo - retornar erro
        const fallbackError = new Error('Não foi possível determinar o usuário para criar o projeto. Certifique-se de que existem usuários no sistema.');
        fallbackError.statusCode = 400;
        throw fallbackError;
      }
    }
    
    // Update body with determined createdById
    const validatedBody = { ...body, createdById };
    
    const validation = validateProject(validatedBody);
    
    if (!validation.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    const project = await projectService.createProject(validation.data);
    
    res.status(201).json({
      message: 'Project created successfully',
      project,
      correlationId: req.correlationId
    });
  });

  // Get all projects
  getAllProjects = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { sort_by: sortBy, sort_order: sortOrder } = req.query;
    const options = {
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc'
    };
    const projects = await projectService.getAllProjects(options);
    
    res.json({
      count: projects.length,
      projects,
      correlationId: req.correlationId
    });
  });

  // Get project by ID
  getProjectById = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const project = await projectService.getProjectById(id);

    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      project,
      correlationId: req.correlationId
    });
  });

  // Update project
  updateProject = ErrorMiddleware.catchAsync(async (req, res, next) => {

    const { id } = req.params;
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    const validation = validateProjectUpdate(body);
    
    if (!validation.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    const project = await projectService.updateProject(id, validation.data);

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
  });

  // Delete project
  deleteProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
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
    
    const project = await projectService.deleteProject(id);

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
  });

  // Get projects by user ID
  getProjectsByUserId = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { userId } = req.params;
    const projects = await projectService.getProjectsByUserId(userId);
    
    res.json({
      count: projects.length,
      projects,
      correlationId: req.correlationId
    });
  });

  // Search projects
  searchProjects = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      const error = new Error('Search query is required');
      error.statusCode = 400;
      throw error;
    }

    const projects = await projectService.searchProjects(q.trim());
    
    res.json({
      count: projects.length,
      projects,
      correlationId: req.correlationId
    });
  });

  // Get project statistics
  getProjectStatistics = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const statistics = await projectService.getProjectStatistics();
    
    res.json({
      statistics,
      correlationId: req.correlationId
    });
  });

  // Archive project
  archiveProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const project = await projectService.archiveProject(id);

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
  });

  // Restore archived project
  restoreProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const project = await projectService.restoreProject(id);

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
  });

  // Get archived projects
  getArchivedProjects = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const projects = await projectService.getArchivedProjects();
    
    res.json({
      count: projects.length,
      projects,
      correlationId: req.correlationId
    });
  });
}

module.exports = new ProjectController();
