const prisma = require('./prismaService');

class TaskService {
  // Validate referenced IDs exist before creating a task
  async validateReferences(data) {
    const errors = [];
    
    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId }
    });
    if (!project) {
      errors.push(`Project with ID ${data.projectId} not found`);
    }
    
    // Check status exists
    const status = await prisma.status.findUnique({
      where: { id: data.statusId }
    });
    if (!status) {
      errors.push(`Status with ID ${data.statusId} not found`);
    }
    
    // Check priority exists
    const priority = await prisma.priority.findUnique({
      where: { id: data.priorityId }
    });
    if (!priority) {
      errors.push(`Priority with ID ${data.priorityId} not found`);
    }
    
    // Check creator exists
    const creator = await prisma.user.findUnique({
      where: { id: data.createdById }
    });
    if (!creator) {
      errors.push(`Creator with ID ${data.createdById} not found`);
    }
    
    // Check assignee exists
    const assignee = await prisma.user.findUnique({
      where: { id: data.assignedToId }
    });
    if (!assignee) {
      errors.push(`Assignee with ID ${data.assignedToId} not found`);
    }
    
    // Check parent task exists if provided
    if (data.parentTaskId) {
      const parentTask = await prisma.task.findUnique({
        where: { id: data.parentTaskId }
      });
      if (!parentTask) {
        errors.push(`Parent task with ID ${data.parentTaskId} not found`);
      } else if (parentTask.projectId !== data.projectId) {
        errors.push(`Parent task belongs to a different project`);
      }
    }
    
    if (errors.length > 0) {
      const error = new Error(`Validation failed: ${errors.join(', ')}`);
      error.validationErrors = errors;
      error.statusCode = 400;
      throw error;
    }
    
    return { project, status, priority, creator, assignee };
  }

  // Create a new task
  async createTask(data) {
    // Validate all referenced IDs exist
    await this.validateReferences(data);
    
    return await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        deadline: new Date(data.deadline),
        position: data.position || 0,
        isCompleted: data.isCompleted || false,
        
        projectId: data.projectId,
        statusId: data.statusId,
        priorityId: data.priorityId,
        createdById: data.createdById,
        assignedToId: data.assignedToId,
        
        parentTaskId: data.parentTaskId || null
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        status: true,
        priority: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        parentTask: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
  }

  // Get all tasks with filters
  async getAllTasks(filters = {}) {
    const where = {};

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.statusId) {
      where.statusId = filters.statusId;
    }

    if (filters.priorityId) {
      where.priorityId = filters.priorityId;
    }

    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted === 'true';
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await prisma.task.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        status: true,
        priority: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        parentTask: {
          select: {
            id: true,
            title: true
          }
        },
        subtasks: {
          select: {
            id: true,
            title: true,
            isCompleted: true
          }
        }
      },
      orderBy: {
        [filters.sortBy || 'deadline']: filters.sortOrder || 'asc'
      }
    });
  }

  // Get task by ID with all details
  async getTaskById(id) {
    return await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        status: true,
        priority: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        parentTask: {
          select: {
            id: true,
            title: true
          }
        },
        subtasks: {
          include: {
            status: true,
            priority: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          }
        },
        dependencies: {
          include: {
            dependentTask: {
              select: {
                id: true,
                title: true,
                status: true
              }
            }
          }
        },
        comments: {
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
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        attachments: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        history: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            timestamp: 'desc'
          }
        }
      }
    });
  }

  // Validate update references
  async validateUpdateReferences(id, data) {
    const errors = [];
    
    // Get current task to check project context
    const currentTask = await prisma.task.findUnique({
      where: { id },
      select: { projectId: true }
    });
    
    if (!currentTask) {
      throw new Error(`Task with ID ${id} not found`);
    }
    
    // Check project exists if being updated
    if (data.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId }
      });
      if (!project) {
        errors.push(`Project with ID ${data.projectId} not found`);
      }
    }
    
    // Check status exists if being updated
    if (data.statusId) {
      const status = await prisma.status.findUnique({
        where: { id: data.statusId }
      });
      if (!status) {
        errors.push(`Status with ID ${data.statusId} not found`);
      }
    }
    
    // Check priority exists if being updated
    if (data.priorityId) {
      const priority = await prisma.priority.findUnique({
        where: { id: data.priorityId }
      });
      if (!priority) {
        errors.push(`Priority with ID ${data.priorityId} not found`);
      }
    }
    
    // Check assignee exists if being updated
    if (data.assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: data.assignedToId }
      });
      if (!assignee) {
        errors.push(`Assignee with ID ${data.assignedToId} not found`);
      }
    }
    
    // Check parent task exists if provided
    if (data.parentTaskId !== undefined) {
      if (data.parentTaskId === null) {
        // Allow null (removing parent)
      } else {
        const parentTask = await prisma.task.findUnique({
          where: { id: data.parentTaskId }
        });
        if (!parentTask) {
          errors.push(`Parent task with ID ${data.parentTaskId} not found`);
        } else {
          // Check parent task belongs to same project (or new project if project is being updated)
          const targetProjectId = data.projectId || currentTask.projectId;
          if (parentTask.projectId !== targetProjectId) {
            errors.push(`Parent task belongs to a different project`);
          }
          
          // Check for circular reference
          if (parentTask.id === id) {
            errors.push(`Task cannot be its own parent`);
          }
        }
      }
    }
    
    if (errors.length > 0) {
      const error = new Error(`Validation failed: ${errors.join(', ')}`);
      error.validationErrors = errors;
      error.statusCode = 400;
      throw error;
    }
  }

  // Update task
  async updateTask(id, data) {
    // Validate update references
    await this.validateUpdateReferences(id, data);
    
    // Check if status is changing to record history
    const oldTask = await prisma.task.findUnique({
      where: { id },
      select: { statusId: true, createdById: true }
    });

    if (!oldTask) {
      throw new Error(`Task with ID ${id} not found`);
    }

    const updateData = {
      title: data.title,
      description: data.description,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      position: data.position,
      isCompleted: data.isCompleted,
      projectId: data.projectId,
      statusId: data.statusId,
      priorityId: data.priorityId,
      assignedToId: data.assignedToId,
      parentTaskId: data.parentTaskId,
      updatedAt: new Date()
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const transaction = [];

    // Add task update
    transaction.push(
      prisma.task.update({
        where: { id },
        data: updateData,
        include: {
          project: true,
          status: true,
          priority: true,
          createdBy: true,
          assignedTo: true
        }
      })
    );

    // Add history record if status changed
    if (data.statusId && oldTask && data.statusId !== oldTask.statusId) {
      transaction.push(
        prisma.taskHistory.create({
          data: {
            taskId: id,
            userId: data.userId || oldTask.createdById,
            oldStatusId: oldTask.statusId,
            newStatusId: data.statusId,
            notes: data.statusChangeNotes
          }
        })
      );
    }

    const results = await prisma.$transaction(transaction);
    return results[0]; // Return the updated task
  }

  // Delete task
  async deleteTask(id) {
    // First delete dependencies, comments, attachments, history
    await prisma.$transaction([
      prisma.dependency.deleteMany({
        where: {
          OR: [
            { taskId: id },
            { dependentTaskId: id }
          ]
        }
      }),
      prisma.comment.deleteMany({
        where: { taskId: id }
      }),
      prisma.attachment.deleteMany({
        where: { taskId: id }
      }),
      prisma.taskHistory.deleteMany({
        where: { taskId: id }
      })
    ]);

    // Then delete the task
    return await prisma.task.delete({
      where: { id }
    });
  }

  // Update task position (for drag and drop)
  async updateTaskPosition(id, position) {
    return await prisma.task.update({
      where: { id },
      data: { position },
      include: {
        project: true,
        status: true,
        priority: true
      }
    });
  }

  // Toggle task completion
  async toggleTaskCompletion(id) {
    const task = await prisma.task.findUnique({
      where: { id },
      select: { isCompleted: true }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return await prisma.task.update({
      where: { id },
      data: { 
        isCompleted: !task.isCompleted,
        updatedAt: new Date()
      },
      include: {
        project: true,
        status: true,
        priority: true
      }
    });
  }

  // Get tasks by project
  async getTasksByProject(projectId, filters = {}) {
    const where = { projectId };

    if (filters.statusId) {
      where.statusId = filters.statusId;
    }

    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted === 'true';
    }

    return await prisma.task.findMany({
      where,
      include: {
        status: true,
        priority: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        subtasks: {
          select: {
            id: true,
            title: true,
            isCompleted: true
          }
        }
      },
      orderBy: {
        position: 'asc'
      }
    });
  }
}

module.exports = new TaskService();