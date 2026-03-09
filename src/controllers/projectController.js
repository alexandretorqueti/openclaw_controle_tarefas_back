const projectService = require('../services/projectService');
const { validateProject, validateProjectUpdate } = require('../validators/projectValidator');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const { snakeToCamel } = require('../utils/caseConverter');

class ProjectController {
  // Create a new project
  createProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    // Determine createdById: prefer authenticated user, fallback to body, then default
    let createdById = body.createdById;
    
    if (req.user && req.user.id) {
      // Use authenticated user's ID (overrides any provided value)
      createdById = req.user.id;
    } else if (!createdById || createdById.trim() === '') {
      // Fallback to default user ID (Alexandre's ID) for development/testing
      createdById = '5fe303cc-19be-4d03-abe6-91a63414005f';
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
    const project = await projectService.deleteProject(id);

    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }

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
