// Migrado para TypeScript - Fase: Controllers
// Arquivo: dependencyController.js

// src/controllers/dependencyController.js

import prisma from '../services/prismaService';
import { ErrorMiddleware } from '../middlewares/errorMiddleware';

class DependencyController {
  // Create a new dependency
  createDependency = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { taskId, dependentTaskId, type = 'BLOCKING' } = req.body;

    // Validate required fields
    if (!taskId || !dependentTaskId) {
      const error = new Error('taskId and dependentTaskId are required');
      (error as any).statusCode = 400;
      throw error;
    }

    // Check if tasks exist
    const [task, dependentTask] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.task.findUnique({ where: { id: dependentTaskId } })
    ]);

    if (!task) {
      const error = new Error(`Task with ID ${taskId} not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    if (!dependentTask) {
      const error = new Error(`Dependent task with ID ${dependentTaskId} not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    // Check if dependency already exists
    const existingDependency = await prisma.dependency.findFirst({
      where: {
        taskId,
        dependentTaskId
      }
    });

    if (existingDependency) {
      const error = new Error('Dependency already exists');
      (error as any).statusCode = 409;
      throw error;
    }

    // Check for circular dependencies
    // Simple check: don't allow if dependentTask already depends on task
    const circularCheck = await prisma.dependency.findFirst({
      where: {
        taskId: dependentTaskId,
        dependentTaskId: taskId
      }
    });

    if (circularCheck) {
      const error = new Error('Circular dependency detected');
      (error as any).statusCode = 400;
      throw error;
    }

    // Create dependency
    const dependency = await prisma.dependency.create({
      data: {
        taskId,
        dependentTaskId,
        type
      },
      include: {
        task: true,
        dependentTask: true
      }
    });

    res.status(201).json({
      status: 'success',
      data: dependency
    });
  });

  // Delete a dependency
  deleteDependency = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const dependentTaskId = Array.isArray(req.params.dependentTaskId) ? req.params.dependentTaskId[0] : req.params.dependentTaskId;

    // Find and delete dependency
    const dependency = await prisma.dependency.findFirst({
      where: {
        taskId,
        dependentTaskId
      }
    });

    if (!dependency) {
      const error = new Error('Dependency not found');
      (error as any).statusCode = 404;
      throw error;
    }

    await prisma.dependency.delete({
      where: {
        id: dependency.id
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Dependency deleted successfully'
    });
  });

// Get dependencies for a task
getTaskDependencies = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
  const taskId = Array.isArray(req.params.taskId)
    ? req.params.taskId[0]
    : req.params.taskId;

  if (!taskId) {
    const error = new Error('taskId is required');
    (error as any).statusCode = 400;
    throw error;
  }

  const dependencies = await prisma.dependency.findMany({
    where: { taskId },
    include: {
      dependentTask: {
        include: {
          status: true,
          priority: true,
          assignedTo: true
        }
      }
    }
  });

  res.status(200).json({
    status: 'success',
    data: dependencies
  });
});
}

export default new DependencyController();