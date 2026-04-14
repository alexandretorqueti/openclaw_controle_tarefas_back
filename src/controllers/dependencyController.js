// src/controllers/dependencyController.js

const _prisma = require('../services/prismaService');
const prisma = _prisma.default || _prisma;
const ErrorMiddleware = require('../middlewares/errorMiddleware');

class DependencyController {
  // Create a new dependency
  createDependency = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { taskId, dependentTaskId, type = 'BLOCKING' } = req.body;

    // Validate required fields
    if (!taskId || !dependentTaskId) {
      const error = new Error('taskId and dependentTaskId are required');
      error.statusCode = 400;
      throw error;
    }

    // Check if tasks exist
    const [task, dependentTask] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.task.findUnique({ where: { id: dependentTaskId } })
    ]);

    if (!task) {
      const error = new Error(`Task with ID ${taskId} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (!dependentTask) {
      const error = new Error(`Dependent task with ID ${dependentTaskId} not found`);
      error.statusCode = 404;
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
      error.statusCode = 409;
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
      error.statusCode = 400;
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
  deleteDependency = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { taskId, dependentTaskId } = req.params;

    // Find and delete dependency
    const dependency = await prisma.dependency.findFirst({
      where: {
        taskId,
        dependentTaskId
      }
    });

    if (!dependency) {
      const error = new Error('Dependency not found');
      error.statusCode = 404;
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
  getTaskDependencies = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { taskId } = req.params;

    const dependencies = await prisma.dependency.findMany({
      where: {
        taskId
      },
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

module.exports = new DependencyController();