// commentService.js

const prisma = require('./prismaService');

// TESTE DE REGRAS E COMENTÁRIOS: Este serviço gerencia comentários e deve receber as regras do projeto
// para verificar se estão sendo enviados corretamente para a IA. Alteração realizada em 25/02/2026.

class CommentService {
  // Create a new comment
  async createComment(data) {
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
  async getCommentsByTask(taskId) {
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
  async getCommentById(id) {
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
  async updateComment(id, data) {
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
  async deleteComment(id) {
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
  async getCommentReplies(commentId) {
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

module.exports = new CommentService();

