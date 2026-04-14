// src/services/taskHistoryService.js

const _prisma = require('./prismaService');
const prisma = _prisma.default || _prisma;

class TaskHistoryService {
  // Get all history records for a task
  async getHistoryByTask(taskId) {
    const history = await prisma.taskHistory.findMany({
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
  }

  // Create a new history record
  async createHistory(data) {
    const history = await prisma.taskHistory.create({
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
  }

  // Get history by ID
  async getHistoryById(id) {
    const history = await prisma.taskHistory.findUnique({
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
  }

  // Delete history record
  async deleteHistory(id) {
    const history = await prisma.taskHistory.delete({
      where: { id }
    });

    return history;
  }
}

module.exports = new TaskHistoryService();

