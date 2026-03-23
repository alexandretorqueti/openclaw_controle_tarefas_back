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
class StatusController {
    constructor() {
        // Get all statuses
        this.getAllStatuses = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const statuses = yield prisma.status.findMany({
                orderBy: {
                    order: 'asc'
                }
            });
            res.json({
                count: statuses.length,
                statuses,
                correlationId: req.correlationId
            });
        }));
        // Get status by ID
        this.getStatusById = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const status = yield prisma.status.findUnique({
                where: { id }
            });
            if (!status) {
                const error = new Error(`Status with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            res.json(Object.assign(Object.assign({}, status), { correlationId: req.correlationId }));
        }));
        // Create a new status
        this.createStatus = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { name, colorCode = '#666666', isFinalState = false, visibleToAi = true, order = 0 } = req.body;
            if (!name) {
                const error = new Error('Name is required');
                error.statusCode = 400;
                throw error;
            }
            const status = yield prisma.status.create({
                data: {
                    name,
                    colorCode: colorCode,
                    isFinalState: isFinalState,
                    visibleToAi,
                    order
                }
            });
            res.status(201).json({
                message: 'Status created successfully',
                status,
                correlationId: req.correlationId
            });
        }));
        // Update status
        this.updateStatus = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { name, color_code, is_final_state, visible_to_ai, order } = req.body;
            // Check if status exists
            const existingStatus = yield prisma.status.findUnique({
                where: { id }
            });
            if (!existingStatus) {
                const error = new Error(`Status with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            const updatedStatus = yield prisma.status.update({
                where: { id },
                data: {
                    name: name !== undefined ? name : existingStatus.name,
                    colorCode: color_code !== undefined ? color_code : existingStatus.colorCode,
                    isFinalState: is_final_state !== undefined ? is_final_state : existingStatus.isFinalState,
                    visibleToAi: visible_to_ai !== undefined ? visible_to_ai : existingStatus.visibleToAi,
                    order: order !== undefined ? order : existingStatus.order
                }
            });
            res.json({
                message: 'Status updated successfully',
                status: updatedStatus,
                correlationId: req.correlationId
            });
        }));
        // Delete status
        this.deleteStatus = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // Check if status exists
            const existingStatus = yield prisma.status.findUnique({
                where: { id }
            });
            if (!existingStatus) {
                const error = new Error(`Status with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            // Check if status is being used by any tasks
            const tasksWithStatus = yield prisma.task.findFirst({
                where: { statusId: id }
            });
            if (tasksWithStatus) {
                const error = new Error('Cannot delete status that is being used by tasks');
                error.statusCode = 400;
                throw error;
            }
            yield prisma.status.delete({
                where: { id }
            });
            res.json({
                message: 'Status deleted successfully',
                correlationId: req.correlationId
            });
        }));
    }
}
module.exports = new StatusController();
