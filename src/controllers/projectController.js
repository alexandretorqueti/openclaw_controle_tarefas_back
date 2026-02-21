const projectService = require('../services/projectService');
const { validateProject, validateProjectUpdate } = require('../validators/projectValidator');
const ErrorMiddleware = require('../middlewares/errorMiddleware');

// Helper function to convert snake_case to camelCase
function snakeToCamel(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        newObj[camelKey] = snakeToCamel(obj[key]);
      }
    }
    return newObj;
  }
  
  return obj;
}

class ProjectController {
  // Create a new project
  createProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    const validation = validateProject(body);
    
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
    const projects = await projectService.getAllProjects();
    
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
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }
    
    res.json({
      ...project,
      correlationId: req.correlationId
    });
  });

  // Update project
  updateProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const validation = validateProjectUpdate(req.body);
    
    if (!validation.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    // Check if project exists
    const existingProject = await projectService.getProjectById(id);
    if (!existingProject) {
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const updatedProject = await projectService.updateProject(id, validation.data);
    
    res.json({
      message: 'Project updated successfully',
      project: updatedProject,
      correlationId: req.correlationId
    });
  });

  // Delete project
  deleteProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    // Check if project exists
    const existingProject = await projectService.getProjectById(id);
    if (!existingProject) {
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    await projectService.deleteProject(id);
    
    res.json({
      message: 'Project deleted successfully',
      correlationId: req.correlationId
    });
  });

  // Get project statistics
  getProjectStatistics = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    // Check if project exists
    const existingProject = await projectService.getProjectById(id);
    if (!existingProject) {
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const statistics = await projectService.getProjectStatistics(id);
    
    res.json({
      ...statistics,
      correlationId: req.correlationId
    });
  });
}

module.exports = new ProjectController();