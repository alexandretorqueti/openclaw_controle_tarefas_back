const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ErrorMiddleware = require('../middlewares/errorMiddleware');

class PriorityController {
  // Get all priorities
  getAllPriorities = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const priorities = await prisma.priority.findMany({
      orderBy: {
        weight: 'asc'
      }
    });
    
    res.json({
      count: priorities.length,
      priorities,
      correlationId: req.correlationId
    });
  });

  // Get priority by ID
  getPriorityById = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const priority = await prisma.priority.findUnique({
      where: { id }
    });
    
    if (!priority) {
      const error = new Error(`Priority with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }
    
    res.json({
      ...priority,
      correlationId: req.correlationId
    });
  });

  // Create a new priority
  createPriority = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { name, weight = 1 } = req.body;
    
    if (!name) {
      const error = new Error('Name is required');
      error.statusCode = 400;
      throw error;
    }

    const priority = await prisma.priority.create({
      data: {
        name,
        weight
      }
    });
    
    res.status(201).json({
      message: 'Priority created successfully',
      priority,
      correlationId: req.correlationId
    });
  });

  // Update priority
  updatePriority = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, weight } = req.body;
    
    // Check if priority exists
    const existingPriority = await prisma.priority.findUnique({
      where: { id }
    });
    
    if (!existingPriority) {
      const error = new Error(`Priority with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const updatedPriority = await prisma.priority.update({
      where: { id },
      data: {
        name,
        weight
      }
    });
    
    res.json({
      message: 'Priority updated successfully',
      priority: updatedPriority,
      correlationId: req.correlationId
    });
  });

  // Delete priority
  deletePriority = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    // Check if priority exists
    const existingPriority = await prisma.priority.findUnique({
      where: { id }
    });
    
    if (!existingPriority) {
      const error = new Error(`Priority with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    // Check if priority is being used by any tasks
    const tasksWithPriority = await prisma.task.findFirst({
      where: { priorityId: id }
    });
    
    if (tasksWithPriority) {
      const error = new Error('Cannot delete priority that is being used by tasks');
      error.statusCode = 400;
      throw error;
    }

    await prisma.priority.delete({
      where: { id }
    });
    
    res.json({
      message: 'Priority deleted successfully',
      correlationId: req.correlationId
    });
  });
}

module.exports = new PriorityController();