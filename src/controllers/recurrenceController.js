var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const taskService = require('../services/taskService');
class RecurrenceController {
    // Get recurring tasks that are due for execution
    getRecurringTasksDue(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tasks = yield taskService.getRecurringTasksDue();
                res.json({
                    count: tasks.length,
                    tasks: tasks.map(task => (Object.assign(Object.assign({}, task), { recurrenceTimes: task.recurrenceTimes ? JSON.parse(task.recurrenceTimes) : null, recurrenceDays: task.recurrenceDays ? JSON.parse(task.recurrenceDays) : null })))
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    // Mark task as executed
    markTaskAsExecuted(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                // Check if task exists
                const existingTask = yield taskService.getTaskById(id);
                if (!existingTask) {
                    return res.status(404).json({
                        error: 'Task not found'
                    });
                }
                const updatedTask = yield taskService.markTaskAsExecuted(id);
                res.json({
                    message: 'Task marked as executed successfully',
                    task: Object.assign(Object.assign({}, updatedTask), { recurrenceTimes: updatedTask.recurrenceTimes ? JSON.parse(updatedTask.recurrenceTimes) : null, recurrenceDays: updatedTask.recurrenceDays ? JSON.parse(updatedTask.recurrenceDays) : null })
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    // Execute all due recurring tasks
    executeAllDueTasks(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dueTasks = yield taskService.getRecurringTasksDue();
                const results = [];
                for (const task of dueTasks) {
                    try {
                        const updatedTask = yield taskService.markTaskAsExecuted(task.id);
                        results.push({
                            taskId: task.id,
                            title: task.title,
                            status: 'executed',
                            nextExecutionAt: updatedTask.nextExecutionAt
                        });
                    }
                    catch (error) {
                        results.push({
                            taskId: task.id,
                            title: task.title,
                            status: 'error',
                            error: error.message
                        });
                    }
                }
                res.json({
                    message: `Executed ${results.filter(r => r.status === 'executed').length} out of ${dueTasks.length} due tasks`,
                    results
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    // Calculate next execution for a task
    calculateNextExecution(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const task = yield taskService.getTaskById(id);
                if (!task) {
                    return res.status(404).json({
                        error: 'Task not found'
                    });
                }
                if (!task.isRecurring) {
                    return res.status(400).json({
                        error: 'Task is not recurring'
                    });
                }
                const taskData = {
                    isRecurring: task.isRecurring,
                    recurrenceType: task.recurrenceType,
                    recurrenceTimes: task.recurrenceTimes ? JSON.parse(task.recurrenceTimes) : null,
                    recurrenceDays: task.recurrenceDays ? JSON.parse(task.recurrenceDays) : null,
                    lastExecutedAt: task.lastExecutedAt
                };
                const nextExecution = taskService.calculateNextExecution(taskData);
                res.json({
                    taskId: task.id,
                    title: task.title,
                    currentNextExecution: task.nextExecutionAt,
                    calculatedNextExecution: nextExecution,
                    taskData
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
module.exports = new RecurrenceController();
