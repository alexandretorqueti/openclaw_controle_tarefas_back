// src/services/taskHistoryService.js
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const prisma = require('./prismaService');
class TaskHistoryService {
    // Get all history records for a task
    getHistoryByTask(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            const history = yield prisma.taskHistory.findMany({
                where: { taskId },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            nickname: true,
                            avatarUrl: true
                        }
                    },
                    task: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });
            return history;
        });
    }
    // Create a new history record
    createHistory(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const history = yield prisma.taskHistory.create({
                data: {
                    taskId: data.taskId,
                    userId: data.userId,
                    oldStatusId: data.oldStatusId,
                    newStatusId: data.newStatusId,
                    notes: data.notes
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            nickname: true,
                            avatarUrl: true
                        }
                    }
                }
            });
            return history;
        });
    }
    // Get history by ID
    getHistoryById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const history = yield prisma.taskHistory.findUnique({
                where: { id },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            nickname: true,
                            avatarUrl: true
                        }
                    },
                    task: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                }
            });
            return history;
        });
    }
    // Delete history record
    deleteHistory(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const history = yield prisma.taskHistory.delete({
                where: { id }
            });
            return history;
        });
    }
}
module.exports = new TaskHistoryService();
