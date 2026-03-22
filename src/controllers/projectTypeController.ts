// Migrado para TypeScript - Fase: Controllers
// Arquivo: projectTypeController.js

import prisma from '../services/prismaService';
import ErrorMiddleware from '../middlewares/errorMiddleware';

class ProjectTypeController {
  // Get all project types
  getAllProjectTypes = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const projectTypes = await prisma.projectType.findMany({
      orderBy: {
        name: 'asc'
      },
      include: {
        projects: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    res.json({
      count: projectTypes.length,
      projectTypes,
      correlationId: req.correlationId
    });
  });

  // Get project type by ID
  getProjectTypeById = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const projectType = await prisma.projectType.findUnique({
      where: { id },
      include: {
        projects: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    if (!projectType) {
      const error = new Error(`Project type with ID ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    }
    
    res.json({
      ...projectType,
      correlationId: req.correlationId
    });
  });

  // Create a new project type
  createProjectType = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { name, persona_prompt, base_rules = '' } = req.body;
    
    if (!name) {
      const error = new Error('Name is required');
      (error as any).statusCode = 400;
      throw error;
    }

    if (!persona_prompt) {
      const error = new Error('Persona prompt is required');
      (error as any).statusCode = 400;
      throw error;
    }

    const projectType = await prisma.projectType.create({
      data: {
        name,
        personaPrompt: persona_prompt,
        baseRules: base_rules
      }
    });
    
    res.status(201).json({
      message: 'Project type created successfully',
      projectType,
      correlationId: req.correlationId
    });
  });

  // Update project type
  updateProjectType = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const { name, persona_prompt, base_rules } = req.body;
    
    // Check if project type exists
    const existingProjectType = await prisma.projectType.findUnique({
      where: { id }
    });
    
    if (!existingProjectType) {
      const error = new Error(`Project type with ID ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    const updatedProjectType = await prisma.projectType.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingProjectType.name,
        personaPrompt: persona_prompt !== undefined ? persona_prompt : existingProjectType.personaPrompt,
        baseRules: base_rules !== undefined ? base_rules : existingProjectType.baseRules
      }
    });
    
    res.json({
      message: 'Project type updated successfully',
      projectType: updatedProjectType,
      correlationId: req.correlationId
    });
  });

  // Delete project type
  deleteProjectType = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    
    // Check if project type exists
    const existingProjectType = await prisma.projectType.findUnique({
      where: { id }
    });
    
    if (!existingProjectType) {
      const error = new Error(`Project type with ID ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    // Check if project type is being used by any projects
    const projectsWithType = await prisma.project.findFirst({
      where: { projectTypeId: id }
    });
    
    if (projectsWithType) {
      const error = new Error('Cannot delete project type that is being used by projects');
      (error as any).statusCode = 400;
      throw error;
    }

    await prisma.projectType.delete({
      where: { id }
    });
    
    res.json({
      message: 'Project type deleted successfully',
      correlationId: req.correlationId
    });
  });
}

export default new ProjectTypeController();