// Migrado para TypeScript - Fase: Services
// Arquivo: taskHistoryService.js

export // src/services/taskHistoryService.js

import prisma from "./prismaService";

class TaskHistoryService {
  // Get all history records for a task
  async getHistoryByTask(taskId): Promise<any> {
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
  async createHistory(data): Promise<any> {
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
  async getHistoryById(id): Promise<any> {
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
  async deleteHistory(id): Promise<any> {
    const history = await prisma.taskHistory.delete({
      where: { id }
    });

    return history;
  }
}

export default new TaskHistoryService();

