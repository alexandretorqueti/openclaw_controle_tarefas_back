// commentService.js
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
// TESTE DE REGRAS E COMENTÁRIOS: Este serviço gerencia comentários e deve receber as regras do projeto
// para verificar se estão sendo enviados corretamente para a IA. Alteração realizada em 25/02/2026.
class CommentService {
    // Check if task exists
    checkTaskExists(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            const task = yield prisma.task.findUnique({
                where: { id: taskId }
            });
            return !!task;
        });
    }
    // Check if user exists
    checkUserExists(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma.user.findUnique({
                where: { id: userId }
            });
            return !!user;
        });
    }
    // Create a new comment
    createComment(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verificar se a tarefa existe
            const taskExists = yield this.checkTaskExists(data.taskId);
            if (!taskExists) {
                throw new Error(`Task with ID ${data.taskId} not found`);
            }
            // Verificar se o usuário existe
            const userExists = yield this.checkUserExists(data.userId);
            if (!userExists) {
                throw new Error(`User with ID ${data.userId} not found`);
            }
            // Se parentCommentId for fornecido, verificar se existe
            if (data.parentCommentId) {
                const parentCommentExists = yield prisma.comment.findUnique({
                    where: { id: data.parentCommentId }
                });
                if (!parentCommentExists) {
                    throw new Error(`Parent comment with ID ${data.parentCommentId} not found`);
                }
            }
            return yield prisma.comment.create({
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
        });
    }
    // Get all comments for a task (with nested replies)
    getCommentsByTask(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.comment.findMany({
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
        });
    }
    // Get comment by ID
    getCommentById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.comment.findUnique({
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
        });
    }
    // Update comment
    updateComment(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.comment.update({
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
        });
    }
    // Delete comment
    deleteComment(id) {
        return __awaiter(this, void 0, void 0, function* () {
            // First, delete all replies (cascade delete)
            yield prisma.comment.deleteMany({
                where: {
                    parentCommentId: id
                }
            });
            // Then delete the main comment
            return yield prisma.comment.delete({
                where: { id }
            });
        });
    }
    // Get replies for a comment
    getCommentReplies(commentId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.comment.findMany({
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
        });
    }
}
module.exports = new CommentService();
