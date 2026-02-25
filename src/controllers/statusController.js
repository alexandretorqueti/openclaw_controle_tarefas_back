const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ErrorMiddleware = require('../middlewares/errorMiddleware');

class StatusController {
  // Get all statuses
  getAllStatuses = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const statuses = await prisma.status.findMany({
      orderBy: {
        order: 'asc'
      }
    });
    
    res.json({
      count: statuses.length,
      statuses,
      correlationId: req.correlationId
    });
  });

  // Get status by ID
  getStatusById = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const status = await prisma.status.findUnique({
      where: { id }
    });
    
    if (!status) {
      const error = new Error(`Status with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }
    
    res.json({
      ...status,
      correlationId: req.correlationId
    });
  });

  // Create a new status
  createStatus = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { name, colorCode = '#666666', isFinalState = false, allowAI = false, order = 0 } = req.body;
    
    if (!name) {
      const error = new Error('Name is required');
      error.statusCode = 400;
      throw error;
    }

    const status = await prisma.status.create({
      data: {
        name,
        colorCode,
        isFinalState,
        allowAI,
        order
      }
    });
    
    res.status(201).json({
      message: 'Status created successfully',
      status,
      correlationId: req.correlationId
    });
  });

  // Update status
  updateStatus = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, colorCode, isFinalState, allowAI, order } = req.body;
    
    // Check if status exists
    const existingStatus = await prisma.status.findUnique({
      where: { id }
    });
    
    if (!existingStatus) {
      const error = new Error(`Status with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const updatedStatus = await prisma.status.update({
      where: { id },
      data: {
        name,
        colorCode,
        isFinalState,
        allowAI,
        order
      }
    });
    
    res.json({
      message: 'Status updated successfully',
      status: updatedStatus,
      correlationId: req.correlationId
    });
  });

  // Delete status
  deleteStatus = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    // Check if status exists
    const existingStatus = await prisma.status.findUnique({
      where: { id }
    });
    
    if (!existingStatus) {
      const error = new Error(`Status with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    // Check if status is being used by any tasks
    const tasksWithStatus = await prisma.task.findFirst({
      where: { statusId: id }
    });
    
    if (tasksWithStatus) {
      const error = new Error('Cannot delete status that is being used by tasks');
      error.statusCode = 400;
      throw error;
    }

    await prisma.status.delete({
      where: { id }
    });
    
    res.json({
      message: 'Status deleted successfully',
      correlationId: req.correlationId
    });
  });
}

module.exports = new StatusController();