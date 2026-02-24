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
        createdById: data.createdById
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
  async getAllProjects() {
    const projects = await prisma.project.findMany({
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
        createdAt: 'desc'
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
    return await prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        regras: data.regras,
        status: data.status,
        updatedAt: new Date()
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

  // Delete project
  async deleteProject(id) {
    // First, delete all tasks in the project
    await prisma.task.deleteMany({
      where: { projectId: id }
    });

    // Then delete the project
    return await prisma.project.delete({
      where: { id }
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