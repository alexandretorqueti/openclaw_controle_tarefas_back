// src/services/taskService.js

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
    
    // Process recurrence fields
    const recurrenceTimes = data.recurrenceTimes ? JSON.stringify(data.recurrenceTimes) : null;
    const recurrenceDays = data.recurrenceDays ? JSON.stringify(data.recurrenceDays) : null;
    
    // Calculate next execution time if task is recurring
    let nextExecutionAt = null;
    if (data.isRecurring && data.recurrenceType) {
      nextExecutionAt = this.calculateNextExecution(data);
    }
    return await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        deadline: new Date(data.deadline),
        position: data.position || 0,
        isCompleted: data.isCompleted || false,
        
        // Recurrence fields
        isRecurring: data.isRecurring || false,
        recurrenceType: data.recurrenceType || null,
        recurrenceTimes: recurrenceTimes,
        recurrenceDays: recurrenceDays,
        lastExecutedAt: null,
        nextExecutionAt: nextExecutionAt,
        
        projectId: data.projectId,
        statusId: data.statusId,
        priorityId: data.priorityId,
        createdById: data.createdById,
        assignedToId: data.assignedToId,
        model: data.model || null,
        
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

    // Default to excluding completed tasks unless explicitly requested
    console.log('DEBUG getAllTasks filters:', filters);
    console.log('DEBUG getAllTasks filters.isCompleted:', filters.isCompleted);
    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted === 'true';
    } else {
      where.isCompleted = false;
    }
    console.log('DEBUG getAllTasks where:', JSON.stringify(where));

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
            name: true,
            description: true,
            regras: true
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
            description: true,
            regras: true
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

    // Process recurrence fields
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
      model: data.model,
      updatedAt: new Date()
    };

    // Add recurrence fields if provided
    if (data.isRecurring !== undefined) {
      updateData.isRecurring = data.isRecurring;
    }
    
    if (data.recurrenceType !== undefined) {
      updateData.recurrenceType = data.recurrenceType;
    }
    
    if (data.recurrenceTimes !== undefined) {
      updateData.recurrenceTimes = data.recurrenceTimes ? JSON.stringify(data.recurrenceTimes) : null;
    }
    
    if (data.recurrenceDays !== undefined) {
      updateData.recurrenceDays = data.recurrenceDays ? JSON.stringify(data.recurrenceDays) : null;
    }
    
    // Recalculate next execution if recurrence fields changed
    if (data.isRecurring || data.recurrenceType || data.recurrenceTimes || data.recurrenceDays) {
      const taskData = await prisma.task.findUnique({
        where: { id },
        select: {
          isRecurring: true,
          recurrenceType: true,
          recurrenceTimes: true,
          recurrenceDays: true,
          lastExecutedAt: true
        }
      });
      
      const combinedData = {
        isRecurring: data.isRecurring !== undefined ? data.isRecurring : taskData.isRecurring,
        recurrenceType: data.recurrenceType !== undefined ? data.recurrenceType : taskData.recurrenceType,
        recurrenceTimes: data.recurrenceTimes !== undefined ? data.recurrenceTimes : (taskData.recurrenceTimes ? JSON.parse(taskData.recurrenceTimes) : null),
        recurrenceDays: data.recurrenceDays !== undefined ? data.recurrenceDays : (taskData.recurrenceDays ? JSON.parse(taskData.recurrenceDays) : null),
        lastExecutedAt: taskData.lastExecutedAt
      };
      
      if (combinedData.isRecurring && combinedData.recurrenceType) {
        updateData.nextExecutionAt = this.calculateNextExecution(combinedData);
      } else {
        updateData.nextExecutionAt = null;
      }
    }

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
      // Determine userId for history: use provided userId, or oldTask.createdById, or fallback to task creator
      const userId = data.userId || oldTask.createdById;
      if (userId) {
        transaction.push(
          prisma.taskHistory.create({
            data: {
              taskId: id,
              userId: userId,
              oldStatusId: oldTask.statusId,
              newStatusId: data.statusId,
              notes: data.statusChangeNotes
            }
          })
        );
      }
      // If userId is not available, skip history creation (log warning)
      else {
        console.warn(`Cannot create task history for task ${id}: userId not available`);
      }
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

    // Default to excluding completed tasks unless explicitly requested
    console.log('DEBUG getTasksByProject filters:', filters);
    console.log('DEBUG getTasksByProject filters.isCompleted:', filters.isCompleted);
    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted === 'true';
    } else {
      where.isCompleted = false;
    }
    console.log('DEBUG getTasksByProject where:', JSON.stringify(where));

    return await prisma.task.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            regras: true
          }
        },
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

  // Get recurring tasks that need execution
  async getRecurringTasksDue() {
    const now = new Date();
    
    return await prisma.task.findMany({
      where: {
        isRecurring: true,
        isCompleted: false,
        OR: [
          {
            nextExecutionAt: {
              lte: now
            }
          },
          {
            nextExecutionAt: null,
            lastExecutedAt: null
          }
        ]
      },
      include: {
        project: true,
        status: true,
        priority: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  // Mark task as executed and calculate next execution
  async markTaskAsExecuted(taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        isRecurring: true,
        recurrenceType: true,
        recurrenceTimes: true,
        recurrenceDays: true,
        lastExecutedAt: true
      }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const updateData = {
      lastExecutedAt: new Date(),
      updatedAt: new Date()
    };

    // Calculate next execution if task is recurring
    if (task.isRecurring && task.recurrenceType) {
      const taskData = {
        isRecurring: task.isRecurring,
        recurrenceType: task.recurrenceType,
        recurrenceTimes: task.recurrenceTimes ? JSON.parse(task.recurrenceTimes) : null,
        recurrenceDays: task.recurrenceDays ? JSON.parse(task.recurrenceDays) : null,
        lastExecutedAt: new Date() // Use current time as last executed
      };
      
      updateData.nextExecutionAt = this.calculateNextExecution(taskData);
    } else {
      updateData.nextExecutionAt = null;
    }

    return await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        project: true,
        status: true,
        priority: true
      }
    });
  }

  // Calculate next execution time based on recurrence rules
  calculateNextExecution(taskData) {
    const now = new Date();
    const lastExecuted = taskData.lastExecutedAt || now;
    
    if (!taskData.recurrenceType) {
      return null;
    }

    switch (taskData.recurrenceType) {
      case 'daily':
        return this.calculateNextDailyExecution(lastExecuted, taskData.recurrenceTimes);
      case 'weekly':
        return this.calculateNextWeeklyExecution(lastExecuted, taskData.recurrenceDays, taskData.recurrenceTimes);
      case 'monthly':
        return this.calculateNextMonthlyExecution(lastExecuted, taskData.recurrenceTimes);
      default:
        return null;
    }
  }

  // Calculate next daily execution
  calculateNextDailyExecution(lastExecuted, recurrenceTimes) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (!recurrenceTimes || !Array.isArray(recurrenceTimes) || recurrenceTimes.length === 0) {
      // Default to same time tomorrow
      const next = new Date(lastExecuted);
      next.setDate(next.getDate() + 1);
      return next;
    }

    // Parse times and find next one
    const times = recurrenceTimes.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date(today);
      date.setHours(hours, minutes, 0, 0);
      return date;
    }).sort((a, b) => a - b);

    // Find next time today
    for (const time of times) {
      if (time > now) {
        return time;
      }
    }

    // If no more times today, use first time tomorrow
    const firstTimeTomorrow = new Date(times[0]);
    firstTimeTomorrow.setDate(firstTimeTomorrow.getDate() + 1);
    return firstTimeTomorrow;
  }

  // Calculate next weekly execution
  calculateNextWeeklyExecution(lastExecuted, recurrenceDays, recurrenceTimes) {
    const now = new Date();
    const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    if (!recurrenceDays || !Array.isArray(recurrenceDays) || recurrenceDays.length === 0) {
      // Default to same day next week
      const next = new Date(lastExecuted);
      next.setDate(next.getDate() + 7);
      return next;
    }

    // Parse days (0-6)
    const days = recurrenceDays.map(Number).sort((a, b) => a - b);
    
    // Find next day this week
    for (const day of days) {
      if (day > today) {
        return this.calculateDateTimeForDay(day, recurrenceTimes, now);
      }
    }

    // If no more days this week, use first day next week
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7 - today + days[0]);
    return this.calculateDateTimeForDay(days[0], recurrenceTimes, nextWeek);
  }

  // Calculate next monthly execution
  calculateNextMonthlyExecution(lastExecuted, recurrenceTimes) {
    const next = new Date(lastExecuted);
    next.setMonth(next.getMonth() + 1);
    
    if (recurrenceTimes && Array.isArray(recurrenceTimes) && recurrenceTimes.length > 0) {
      // Use first time for monthly recurrence
      const [hours, minutes] = recurrenceTimes[0].split(':').map(Number);
      next.setHours(hours, minutes, 0, 0);
    }
    
    return next;
  }

  // Helper: Calculate date/time for a specific day
  calculateDateTimeForDay(dayOfWeek, recurrenceTimes, baseDate) {
    const date = new Date(baseDate);
    const currentDay = date.getDay();
    const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
    date.setDate(date.getDate() + daysToAdd);
    
    if (recurrenceTimes && Array.isArray(recurrenceTimes) && recurrenceTimes.length > 0) {
      // Use first time for the day
      const [hours, minutes] = recurrenceTimes[0].split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    } else {
      // Default to same time
      date.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
    }
    
    return date;
  }

  // === NOVO MÉTODO: Obter a próxima tarefa para um usuário (usado pelo Jarbas) ===
  async getNextTaskForUser(nickname) {
    // 1. Encontrar o usuário pelo nickname
    const user = await prisma.user.findFirst({
      where: { nickname: nickname }
    });

    if (!user) {
      console.warn(`[TaskService] Usuário com nickname '${nickname}' não encontrado.`);
      return null;
    }

    // 2. Buscar todos os IDs de status que são visíveis para a IA
    const aiVisibleStatuses = await prisma.status.findMany({
      where: { visible_to_ai: true },
      select: { id: true }
    });

    if (!aiVisibleStatuses || aiVisibleStatuses.length === 0) {
      console.warn(`[TaskService] Nenhum status visível para IA encontrado no banco.`);
      return null;
    }

    const statusIds = aiVisibleStatuses.map(status => status.id);

    // 3. Buscar a primeira tarefa que atenda aos critérios, ordenada pela sua regra de negócio
    const nextTask = await prisma.task.findFirst({
      where: {
        assignedToId: user.id,            // Atribuída ao Jarbas
        isCompleted: false,               // Não pode estar concluída
        statusId: { in: statusIds }       // O status atual permite ação da IA
      },
      orderBy: [
        { position: 'asc' },              // Prioriza quem está no topo do Kanban/Lista
        { deadline: 'asc' }               // Desempata por quem vence primeiro
      ],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            regras: true                  // Crucial para o contexto da IA
          }
        },
        status: {
          select: { name: true }
        },
        priority: {
          select: { name: true }
        }
      }
    });

    return nextTask;
  }
}

module.exports = new TaskService();