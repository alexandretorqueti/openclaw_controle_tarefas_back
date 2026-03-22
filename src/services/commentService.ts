// Migrado para TypeScript - Fase: Services
// Arquivo: commentService.js

export // commentService.js

import prisma from "./prismaService";

// TESTE DE REGRAS E COMENTÁRIOS: Este serviço gerencia comentários e deve receber as regras do projeto
// para verificar se estão sendo enviados corretamente para a IA. Alteração realizada em 25/02/2026.

class CommentService {
  // Check if task exists
  async checkTaskExists(taskId): Promise<any> {
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });
    return !!task;
  }

  // Check if user exists
  async checkUserExists(userId): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    return !!user;
  }

  // Create a new comment
  async createComment(data): Promise<any> {
    // Verificar se a tarefa existe
    const taskExists = await this.checkTaskExists(data.taskId);
    if (!taskExists) {
      throw new Error(`Task with ID ${data.taskId} not found`);
    }
    
    // Verificar se o usuário existe
    const userExists = await this.checkUserExists(data.userId);
    if (!userExists) {
      throw new Error(`User with ID ${data.userId} not found`);
    }
    
    // Se parentCommentId for fornecido, verificar se existe
    if (data.parentCommentId) {
      const parentCommentExists = await prisma.comment.findUnique({
        where: { id: data.parentCommentId }
      });
      if (!parentCommentExists) {
        throw new Error(`Parent comment with ID ${data.parentCommentId} not found`);
      }
    }
    
    return await prisma.comment.create({
      data: {
        content: data.content,
        taskId: data.taskId,
        userId: data.userId,
        parentCommentId: data.parentCommentId || null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        task: {
          select: {
            id: true,
            title: true
          }
        },
        parentComment: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });
  }

  // Get all comments for a task (with nested replies)
  async getCommentsByTask(taskId): Promise<any> {
    return await prisma.comment.findMany({
      where: {
        taskId: taskId,
        parentCommentId: null // Get only top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            },
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  }

  // Get comment by ID
  async getCommentById(id): Promise<any> {
    return await prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        task: {
          select: {
            id: true,
            title: true
          }
        },
        parentComment: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });
  }

  // Update comment
  async updateComment(id, data): Promise<any> {
    return await prisma.comment.update({
      where: { id },
      data: {
        content: data.content,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        task: {
          select: {
            id: true,
            title: true
          }
        },
        parentComment: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });
  }

  // Delete comment
  async deleteComment(id): Promise<any> {
    // First, delete all replies (cascade delete)
    await prisma.comment.deleteMany({
      where: {
        parentCommentId: id
      }
    });

    // Then delete the main comment
    return await prisma.comment.delete({
      where: { id }
    });
  }

  // Get replies for a comment
  async getCommentReplies(commentId): Promise<any> {
    return await prisma.comment.findMany({
      where: {
        parentCommentId: commentId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  }
}

export default new CommentService();
