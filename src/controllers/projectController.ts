// src/controllers/projectController.ts

import { Request, Response, NextFunction } from 'express';
import projectService from '../services/projectService';
import { validateProject, validateProjectUpdate } from '../validators/projectValidator';
import { ErrorMiddleware } from '../middlewares/errorMiddleware';
import { snakeToCamel } from '../utils/caseConverter';
import UserResolver from '../utils/userResolver';

// Interface estendida para suportar as propriedades customizadas
declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; [key: string]: any };
    correlationId?: string;
  }
}

class ProjectController {
  /**
   * FIX 2026-03-10: Frontend buttons edit/delete projects have priority.
   * No backend change needed for priority, but types must be strict.
   */
  createProject = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    console.log('🔍 CREATE /api/projects - Campos recebidos:', JSON.stringify(body, null, 2));
    
    // Determine createdById: prefer authenticated user, otherwise use provided ID
    let createdById: string = body.createdById;
    
    if (req.user && req.user.id) {
      createdById = req.user.id;
    } else if (!createdById || createdById.trim() === '') {
      try {
        const defaultUserId = await UserResolver.getDefaultUserId();
        
        if (defaultUserId) {
          createdById = defaultUserId;
          console.log(`Usando usuário padrão para criação de projeto: ${defaultUserId}`);
        } else {
          const error = new Error('Nenhum usuário encontrado no sistema.');
          error.statusCode = 400;
          throw error;
        }
      } catch (error: any) {
        console.error('Erro ao buscar usuário padrão:', error.message);
        const fallbackError = new Error('Não foi possível determinar o usuário para criar o projeto.');
        fallbackError.statusCode = 400;
        throw fallbackError;
      }
    }
    
    const validatedBody = { ...body, createdById };
    const validation = validateProject(validatedBody);
    
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.errors = validation.errors;
      error.statusCode = 400;
      throw error;
    }

    const project = await projectService.createProject(validation.data);
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project,
      correlationId: req.correlationId
    });
  });

  // Get all projects
  getAllProjects = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sortBy = (req.query.sort_by as string) || 'createdAt';
    const sortOrder = (req.query.sort_order as string) || 'desc';
    
    const options = { sortBy, sortOrder };
    const projects = await projectService.getAllProjects(options);
    
    res.json({
      success: true,
      count: projects.length,
      projects,
      correlationId: req.correlationId
    });
  });

  // Get project by ID
  getProjectById = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const project = await projectService.getProjectById(id);

    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      project,
      correlationId: req.correlationId
    });
  });

  // Update project
  updateProject = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const body = snakeToCamel(req.body);
    
    const existingProject = await projectService.getProjectById(id);

    if (!existingProject) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    
    const validation = validateProjectUpdate(body, existingProject);
    
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.errors = validation.errors;
      error.statusCode = 400;
      throw error;
    }

    const project = await projectService.updateProject(id, validation.data);

    res.json({
      success: true,
      message: 'Project updated successfully',
      project,
      correlationId: req.correlationId
    });
  });

  // Delete project
  deleteProject = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    if (!id || id.trim() === '') {
      const error = new Error('Project ID is required');
      error.statusCode = 400;
      throw error;
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      const error = new Error('Invalid project ID format');
      error.statusCode = 400;
      throw error;
    }
    
    const project = await projectService.deleteProject(id);

    if (!project) {
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      throw error;
    }

    res.json({
      success: true,
      message: 'Project deleted successfully',
      project,
      correlationId: req.correlationId
    });
  });

 

  

 

 

 
}

export default new ProjectController();