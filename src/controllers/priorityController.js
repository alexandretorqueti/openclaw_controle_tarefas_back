var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ErrorMiddleware = require('../middlewares/errorMiddleware');
class PriorityController {
    constructor() {
        // Get all priorities
        this.getAllPriorities = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const priorities = yield prisma.priority.findMany({
                orderBy: {
                    weight: 'asc'
                }
            });
            res.json({
                count: priorities.length,
                priorities,
                correlationId: req.correlationId
            });
        }));
        // Get priority by ID
        this.getPriorityById = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const priority = yield prisma.priority.findUnique({
                where: { id }
            });
            if (!priority) {
                const error = new Error(`Priority with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            res.json(Object.assign(Object.assign({}, priority), { correlationId: req.correlationId }));
        }));
        // Create a new priority
        this.createPriority = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { name, weight = 1 } = req.body;
            if (!name) {
                const error = new Error('Name is required');
                error.statusCode = 400;
                throw error;
            }
            const priority = yield prisma.priority.create({
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
        }));
        // Update priority
        this.updatePriority = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { name, weight } = req.body;
            // Check if priority exists
            const existingPriority = yield prisma.priority.findUnique({
                where: { id }
            });
            if (!existingPriority) {
                const error = new Error(`Priority with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            const updatedPriority = yield prisma.priority.update({
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
        }));
        // Delete priority
        this.deletePriority = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // Check if priority exists
            const existingPriority = yield prisma.priority.findUnique({
                where: { id }
            });
            if (!existingPriority) {
                const error = new Error(`Priority with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            // Check if priority is being used by any tasks
            const tasksWithPriority = yield prisma.task.findFirst({
                where: { priorityId: id }
            });
            if (tasksWithPriority) {
                const error = new Error('Cannot delete priority that is being used by tasks');
                error.statusCode = 400;
                throw error;
            }
            yield prisma.priority.delete({
                where: { id }
            });
            res.json({
                message: 'Priority deleted successfully',
                correlationId: req.correlationId
            });
        }));
    }
}
module.exports = new PriorityController();
