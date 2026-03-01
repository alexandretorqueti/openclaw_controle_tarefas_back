// src/controllers/taskHistoryController.js

const taskHistoryService = require('../services/taskHistoryService');
const ErrorMiddleware = require('../middlewares/errorMiddleware');

class TaskHistoryController {
  // Get all history records for a task
  getHistoryByTask = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { taskId } = req.params;
    const history = await taskHistoryService.getHistoryByTask(taskId);
    
    res.json({
      count: history.length,
      history,
      correlationId: req.correlationId
    });
  });

  // Get history by ID
  getHistoryById = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const history = await taskHistoryService.getHistoryById(id);

    if (!history) {
      const error = new Error('History record not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      history,
      correlationId: req.correlationId
    });
  });

  // Create a new history record
  createHistory = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const history = await taskHistoryService.createHistory(req.body);
    
    res.status(201).json({
      message: 'History record created successfully',
      history,
      correlationId: req.correlationId
    });
  });

  // Delete history record
  deleteHistory = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const history = await taskHistoryService.deleteHistory(id);

    if (!history) {
      const error = new Error('History record not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'History record deleted successfully',
      history,
      correlationId: req.correlationId
    });
  });
}

module.exports = new TaskHistoryController();
