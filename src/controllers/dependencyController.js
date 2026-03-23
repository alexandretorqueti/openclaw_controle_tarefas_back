// src/controllers/dependencyController.js
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const prisma = require('../services/prismaService');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
class DependencyController {
    constructor() {
        // Create a new dependency
        this.createDependency = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { taskId, dependentTaskId, type = 'BLOCKING' } = req.body;
            // Validate required fields
            if (!taskId || !dependentTaskId) {
                const error = new Error('taskId and dependentTaskId are required');
                error.statusCode = 400;
                throw error;
            }
            // Check if tasks exist
            const [task, dependentTask] = yield Promise.all([
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
            const existingDependency = yield prisma.dependency.findFirst({
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
            const circularCheck = yield prisma.dependency.findFirst({
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
            const dependency = yield prisma.dependency.create({
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
        }));
        // Delete a dependency
        this.deleteDependency = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { taskId, dependentTaskId } = req.params;
            // Find and delete dependency
            const dependency = yield prisma.dependency.findFirst({
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
            yield prisma.dependency.delete({
                where: {
                    id: dependency.id
                }
            });
            res.status(200).json({
                status: 'success',
                message: 'Dependency deleted successfully'
            });
        }));
        // Get dependencies for a task
        this.getTaskDependencies = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { taskId } = req.params;
            const dependencies = yield prisma.dependency.findMany({
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
        }));
    }
}
module.exports = new DependencyController();
