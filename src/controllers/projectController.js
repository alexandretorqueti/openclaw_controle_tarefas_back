const projectService = require('../services/projectService');
const { validateProject, validateProjectUpdate } = require('../validators/projectValidator');

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
  async createProject(req, res, next) {
    try {
      // Convert snake_case to camelCase if needed
      const body = snakeToCamel(req.body);
      
      const validation = validateProject(body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      const project = await projectService.createProject(validation.data);
      
      res.status(201).json({
        message: 'Project created successfully',
        project
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all projects
  async getAllProjects(req, res, next) {
    try {
      const projects = await projectService.getAllProjects();
      
      res.json({
        count: projects.length,
        projects
      });
    } catch (error) {
      next(error);
    }
  }

  // Get project by ID
  async getProjectById(req, res, next) {
    try {
      const { id } = req.params;
      const project = await projectService.getProjectById(id);
      
      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }
      
      res.json(project);
    } catch (error) {
      next(error);
    }
  }

  // Update project
  async updateProject(req, res, next) {
    try {
      const { id } = req.params;
      const validation = validateProjectUpdate(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      // Check if project exists
      const existingProject = await projectService.getProjectById(id);
      if (!existingProject) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      const updatedProject = await projectService.updateProject(id, validation.data);
      
      res.json({
        message: 'Project updated successfully',
        project: updatedProject
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete project
  async deleteProject(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if project exists
      const existingProject = await projectService.getProjectById(id);
      if (!existingProject) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      await projectService.deleteProject(id);
      
      res.json({
        message: 'Project deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get project statistics
  async getProjectStatistics(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if project exists
      const existingProject = await projectService.getProjectById(id);
      if (!existingProject) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      const statistics = await projectService.getProjectStatistics(id);
      
      res.json(statistics);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProjectController();