const prisma = require('./prismaService');

class ProjectService {
  // Create a new project
  async createProject(data) {
    return await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        regras: data.regras || null,
        status: data.status !== undefined ? data.status : true,
        ativo: data.ativo !== undefined ? data.ativo : true,
        createdById: data.createdById,
        projectTypeId: data.projectTypeId || null,
        // Novos campos
        frontendPath: data.frontendPath || null,
        frontendPort: data.frontendPort || null,
        backendPath: data.backendPath || null,
        backendPort: data.backendPort || null,
        repositoryUrl: data.repositoryUrl || null,
        pastaBase: data.pastaBase || null,
        frontendBuildCmd: data.frontendBuildCmd || null,
        backendBuildCmd: data.backendBuildCmd || null
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  // Get all projects with task counts
  async getAllProjects(options = {}) {
    const { sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    // Validate sort fields
    const validSortFields = ['createdAt', 'updatedAt', 'name'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const projects = await prisma.project.findMany({
      where: { ativo: true },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        tasks: {
          select: {
            id: true,
            isCompleted: true,
            deadline: true
          }
        }
      },
      orderBy: {
        [sortField]: sortDirection
      }
    });
    
    // Calculate statistics for each project
    return projects.map(project => {
      const tasks = project.tasks;
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.isCompleted).length;
      const overdueTasks = tasks.filter(t => 
        !t.isCompleted && new Date(t.deadline) < new Date()
      ).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...project,
        statistics: {
          totalTasks,
          completedTasks,
          overdueTasks,
          progress
        }
      };
    });
  }

  // Get project by ID with details
  async getProjectById(id) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        tasks: {
          include: {
            status: true,
            priority: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!project) {
      return null;
    }

    // Calculate statistics
    const tasks = project.tasks;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const overdueTasks = tasks.filter(t => 
      !t.isCompleted && new Date(t.deadline) < new Date()
    ).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...project,
      statistics: {
        totalTasks,
        completedTasks,
        overdueTasks,
        progress
      }
    };
  }

  // Update project
  async updateProject(id, data) {
    const updateData = {
      name: data.name,
      description: data.description,
      regras: data.regras,
      status: data.status,
      ativo: data.ativo,
      updatedAt: new Date()
    };
    
    // Campo projectTypeId
    if (data.projectTypeId !== undefined) updateData.projectTypeId = data.projectTypeId;
    
    // Adicionar novos campos apenas se fornecidos
    if (data.frontendPath !== undefined) updateData.frontendPath = data.frontendPath;
    if (data.frontendPort !== undefined) updateData.frontendPort = data.frontendPort;
    if (data.backendPath !== undefined) updateData.backendPath = data.backendPath;
    if (data.backendPort !== undefined) updateData.backendPort = data.backendPort;
    if (data.repositoryUrl !== undefined) updateData.repositoryUrl = data.repositoryUrl;
    if (data.pastaBase !== undefined) updateData.pastaBase = data.pastaBase;
    if (data.frontendBuildCmd !== undefined) updateData.frontendBuildCmd = data.frontendBuildCmd;
    if (data.backendBuildCmd !== undefined) updateData.backendBuildCmd = data.backendBuildCmd;
    
    return await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  // Delete project (soft delete)
  async deleteProject(id) {
    // Soft delete: set ativo = false, status = false
    return await prisma.project.update({
      where: { id },
      data: {
        ativo: false,
        status: false,
        updatedAt: new Date()
      }
    });
  }

  // Get project statistics
  async getProjectStatistics(id) {
    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      select: {
        id: true,
        isCompleted: true,
        deadline: true,
        status: true,
        priority: true
      }
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const overdueTasks = tasks.filter(t => 
      !t.isCompleted && new Date(t.deadline) < new Date()
    ).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Group by status
    const statusCounts = {};
    tasks.forEach(task => {
      const statusName = task.status.name;
      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
    });

    // Group by priority
    const priorityCounts = {};
    tasks.forEach(task => {
      const priorityName = task.priority.name;
      priorityCounts[priorityName] = (priorityCounts[priorityName] || 0) + 1;
    });

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      progress,
      statusCounts,
      priorityCounts
    };
  }
}

module.exports = new ProjectService();