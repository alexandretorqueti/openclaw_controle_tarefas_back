const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// src/services/taskService.js

const prisma = require('./prismaService');

class TaskService {
  // Função auxiliar para executar git
  execGit(args, cwd) {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, { cwd, stdio: 'pipe' });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => stdout += data.toString());
      child.stderr.on('data', (data) => stderr += data.toString());
      child.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`git ${args[0]} failed: ${stderr}`));
      });
    });
  }

  // Função principal de commit
  async checkAndCommit(projectPath, taskId, taskTitle) {
    try {
      // Verificar se path existe e tem .git
      if (!fs.existsSync(projectPath) || !fs.existsSync(path.join(projectPath, '.git'))) {
        return false;
      }

      // Verificar alterações
      const status = await this.execGit(['status', '--porcelain'], projectPath);
      if (!status.trim()) return false; // Sem alterações

      // Fazer commit
      await this.execGit(['add', '.'], projectPath);
      const commitMessage = `${taskId}: ${taskTitle}`;
      await this.execGit(['commit', '-m', commitMessage], projectPath);
      return true;
    } catch (error) {
      console.error(`Git commit failed for ${projectPath}:`, error.message);
      return false;
    }
  }
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
    // Handle both arrays and already stringified JSON
    const recurrenceTimes = data.recurrenceTimes ? 
      (typeof data.recurrenceTimes === 'string' ? data.recurrenceTimes : JSON.stringify(data.recurrenceTimes)) : 
      null;
    const recurrenceDays = data.recurrenceDays ? 
      (typeof data.recurrenceDays === 'string' ? data.recurrenceDays : JSON.stringify(data.recurrenceDays)) : 
      null;
    
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
    console.log('DEBUG getAllTasks filters keys:', Object.keys(filters));
    console.log('DEBUG getAllTasks filters type of isCompleted:', typeof filters.isCompleted);
    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted === 'true';
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
      updateData.recurrenceTimes = data.recurrenceTimes ? 
        (typeof data.recurrenceTimes === 'string' ? data.recurrenceTimes : JSON.stringify(data.recurrenceTimes)) : 
        null;
    }
    
    if (data.recurrenceDays !== undefined) {
      updateData.recurrenceDays = data.recurrenceDays ? 
        (typeof data.recurrenceDays === 'string' ? data.recurrenceDays : JSON.stringify(data.recurrenceDays)) : 
        null;
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
    console.log('DEBUG getTasksByProject filters keys:', Object.keys(filters));
    console.log('DEBUG getTasksByProject filters type of isCompleted:', typeof filters.isCompleted);
    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted === 'true';
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
    const now = new Date();

    console.log(`DEBUG: Buscando próxima tarefa para usuário ${nickname} às ${now.toISOString()}`);

    const [user, aiStatuses] = await Promise.all([
      prisma.user.findUnique({ where: { nickname } }),
      prisma.status.findMany({ where: { visibleToAi: true }, select: { id: true } })
    ]);

    if (!user || aiStatuses.length === 0) return null;
    const statusIds = aiStatuses.map(s => s.id);

    // MÁGICA AQUI: A query já filtra recursivas que estão no futuro!
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: user.id,
        isCompleted: false,
        statusId: { in: statusIds },
        // A tarefa tem que ser: Normal OU (Recursiva E já passou do horário previsto)
        OR: [
          { isRecurring: false },
          { 
            isRecurring: true, 
            nextExecutionAt: { lte: now } // Traz só o que venceu ou é null (primeira vez)
          },
          {
             isRecurring: true,
             nextExecutionAt: null
          }
        ]
      },
      include: {
        priority: true,
        dependencies: { include: { task: true } }
      }
    });

    const playableTasks = tasks.filter(t => t.dependencies.every(dep => dep.task.isCompleted));
    console.log(`
      
      DEBUG: Tarefas atribuídas a ${nickname} que passaram na dependência: ${playableTasks.map(t => t.title).join('; ')}
      Quantidade total de tarefas atribuídas a ${nickname} (sem filtrar dependências): ${playableTasks.length}
      `);
    if (playableTasks.length === 0) return null;

    playableTasks.sort((a, b) => {
      // Como a query só trouxe recursivas vencidas, se ela é recursiva, ela DEVE ir pro topo.
      if (a.isRecurring && !b.isRecurring) return -1;
      if (!a.isRecurring && b.isRecurring) return 1;

      // Se ambas são recursivas, a mais atrasada ganha
      if (a.isRecurring && b.isRecurring) {
        const dateA = a.nextExecutionAt || a.createdAt;
        const dateB = b.nextExecutionAt || b.createdAt;
        console.log(`
          DEBUG: Comparando recursivas ${a.title} (next: ${dateA.toISOString()}) e ${b.title} (next: ${dateB.toISOString()})
          `);
        return dateA.getTime() - dateB.getTime();
      }

      // Se nenhuma é recursiva, vai por peso e depois criação
      if (a.priority.weight !== b.priority.weight) {
        console.log(`
          DEBUG: Comparando prioridades ${a.priority.name} (peso: ${a.priority.weight}) e ${b.priority.name} (peso: ${b.priority.weight})
          `);
        return b.priority.weight - a.priority.weight;
      }

      console.log(`
        DEBUG: Comparando por deadline ${a.title} (deadline: ${a.deadline.toISOString()}) e ${b.title} (deadline: ${b.deadline.toISOString()})
        `);
      return (a.deadline || a.createdAt).getTime() - (b.deadline || b.createdAt).getTime();
    });
   
    console.log(`
      DEBUG: Tarefas encontradas para ${nickname}: ${playableTasks.map(t => `${t.title} (recursiva: ${t.isRecurring}, próxima execução: ${t.nextExecutionAt})`).join('; ')}
      `);
    return playableTasks[0];
  }

  // Finalize task - find first final status and update task
// Finalize task - Lida com finalização de normais e reinício de recursivas
  async finalizeTask(taskId, userId, executionNotes = null) {
    // 1. Busca a tarefa atual
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!existingTask) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    // Fallback para o userId caso não venha na requisição (ideal pegar do token de auth)
    const actionUserId = userId || existingTask.assignedToId || existingTask.createdById;

    // ==========================================
    // FLUXO A: TAREFA RECURSIVA (O RESET)
    // ==========================================
    if (existingTask.isRecurring) {
      // Pega o status inicial (o de menor 'order' - ex: "To Do" / "Backlog")
      const firstStatus = await prisma.status.findFirst({
        orderBy: { order: 'asc' }
      });

      if (!firstStatus) throw new Error('Nenhum status configurado no sistema.');

      // Calcula a próxima data de execução com base no horário de AGORA
      const taskDataForCalc = { ...existingTask, lastExecutedAt: new Date() };
      const nextExecutionAt = this.calculateNextExecution(taskDataForCalc);

      // Executa a atualização e o registro de histórico na mesma transação
      const [updatedTask, historyRecord] = await prisma.$transaction([
        prisma.task.update({
          where: { id: taskId },
          data: {
            statusId: firstStatus.id, // Volta pro início do quadro
            lastExecutedAt: new Date(),
            nextExecutionAt: nextExecutionAt,
            isCompleted: false // Garante que a tarefa continua viva
          },
          include: { project: true, status: true, priority: true }
        }),
        prisma.taskHistory.create({
          data: {
            taskId: taskId,
            userId: actionUserId,
            oldStatusId: existingTask.statusId,
            newStatusId: firstStatus.id,
            // Aqui entra o pulo do gato: o campo text que você pediu!
            notes: executionNotes || 'Execução de rotina concluída. Tarefa reiniciada.'
          }
        })
      ]);

            // Controle de versão automático após finalização
      try {
        const project = await prisma.project.findUnique({
          where: { id: existingTask.projectId },
          select: { frontendPath: true, backendPath: true }
        });
        if (project?.frontendPath) {
          await this.checkAndCommit(project.frontendPath, taskId, existingTask.title);
        }
        if (project?.backendPath) {
          await this.checkAndCommit(project.backendPath, taskId, existingTask.title);
        }
      } catch (gitError) {
        console.error('Git automation failed:', gitError.message);
      }

return {
        task: updatedTask,
        status: firstStatus,
        history: historyRecord,
        isRecurringReset: true
      };
    }

    // ==========================================
    // FLUXO B: TAREFA NORMAL (FINALIZAÇÃO REAL)
    // ==========================================
    const finalStatus = await prisma.status.findFirst({
      where: { isFinalState: true },
      orderBy: { order: 'asc' }
    });

    if (!finalStatus) throw new Error('Nenhum status final configurado no sistema.');

    const [updatedTask, historyRecord] = await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: {
          statusId: finalStatus.id,
          isCompleted: false, // Marca como finalizada de fato
          lastExecutedAt: new Date(),
          nextExecutionAt: null
        },
        include: { project: true, status: true, priority: true }
      }),
      prisma.taskHistory.create({
        data: {
          taskId: taskId,
          userId: actionUserId,
          oldStatusId: existingTask.statusId,
          newStatusId: finalStatus.id,
          notes: executionNotes || 'Tarefa finalizada.'
        }
      })
    ]);

          // Controle de versão automático após finalização
      try {
        const project = await prisma.project.findUnique({
          where: { id: existingTask.projectId },
          select: { frontendPath: true, backendPath: true }
        });
        if (project?.frontendPath) {
          await this.checkAndCommit(project.frontendPath, taskId, existingTask.title);
        }
        if (project?.backendPath) {
          await this.checkAndCommit(project.backendPath, taskId, existingTask.title);
        }
      } catch (gitError) {
        console.error('Git automation failed:', gitError.message);
      }

return {
      task: updatedTask,
      status: finalStatus,
      history: historyRecord,
      isRecurringReset: false
    };
  }
}

module.exports = new TaskService();

