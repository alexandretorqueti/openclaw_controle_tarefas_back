import { Request, Response, NextFunction } from 'express';
import projectService from '../services/projectService';
import { validateProject, validateProjectUpdate } from '../validators/projectValidator';
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const { snakeToCamel } = require('../utils/caseConverter');
import UserResolver from '../utils/userResolver';

class ProjectController {
  createProject = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const body = snakeToCamel(req.body);
    
    let createdById: string = body.createdById;
    
    if ((req as any).user && (req as any).user.id) {
      createdById = (req as any).user.id;
    } else if (!createdById || createdById.trim() === '') {
      try {
        const defaultUserId = await UserResolver.getDefaultUserId();
        if (defaultUserId) {
          createdById = defaultUserId;
        } else {
          const error: any = new Error('Nenhum usuário encontrado no sistema.');
          error.statusCode = 400;
          throw error;
        }
      } catch (error: any) {
        const fallbackError: any = new Error('Não foi possível determinar o usuário.');
        fallbackError.statusCode = 400;
        throw fallbackError;
      }
    }
    
    const validatedBody = { ...body, createdById };
    const validation = validateProject(validatedBody);
    
    if (!validation.success) {
      const error: any = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    const project = await projectService.createProject(validation.data);
    
    res.status(201).json({
      message: 'Project created successfully',
      project,
      correlationId: (req as any).correlationId
    });
  });

  getAllProjects = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { sort_by, sort_order } = req.query;
    const options = {
      sortBy: (sort_by as string) || 'createdAt',
      sortOrder: (sort_order as 'asc' | 'desc') || 'desc'
    };
    const projects = await projectService.getAllProjects(options);
    
    res.json({
      count: projects.length,
      projects,
      correlationId: (req as any).correlationId
    });
  });

  getProjectById = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const project = await projectService.getProjectById(id);

    if (!project) {
      const error: any = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      project,
      correlationId: (req as any).correlationId
    });
  });

  updateProject = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const body = snakeToCamel(req.body);
    const validation = validateProjectUpdate(body);
    
    if (!validation.success) {
      const error: any = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    const project = await projectService.updateProject(id, validation.data);

    if (!project) {
      const error: any = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Project updated successfully',
      project,
      correlationId: (req as any).correlationId
    });
  });

  deleteProject = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    
    if (!id || id.trim() === '') {
      const error: any = new Error('Project ID is required');
      error.statusCode = 400;
      throw error;
    }
    
    const project = await projectService.deleteProject(id);

    if (!project) {
      const error: any = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Project deleted successfully',
      project,
      correlationId: (req as any).correlationId
    });
  });
}

export default new ProjectController();
