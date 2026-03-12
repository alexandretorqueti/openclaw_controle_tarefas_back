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
        agent: data.agent || null,
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
    if (data.frontendPath !== undefined) updateData.frontendPath = data.frontendPath || null;
    if (data.frontendPort !== undefined) updateData.frontendPort = data.frontendPort || null;
    if (data.backendPath !== undefined) updateData.backendPath = data.backendPath || null;
    if (data.backendPort !== undefined) updateData.backendPort = data.backendPort || null;
    if (data.repositoryUrl !== undefined) updateData.repositoryUrl = data.repositoryUrl || null;
    if (data.pastaBase !== undefined) updateData.pastaBase = data.pastaBase || null;
    if (data.agent !== undefined) updateData.agent = data.agent || null;
    if (data.frontendBuildCmd !== undefined) updateData.frontendBuildCmd = data.frontendBuildCmd || null;
    if (data.backendBuildCmd !== undefined) updateData.backendBuildCmd = data.backendBuildCmd || null;
    
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
    console.log('🔍 projectService.deleteProject - ID recebido:', id);
    
    try {
      // Verificar se projeto existe
      const project = await prisma.project.findUnique({
        where: { id }
      });
      
      if (!project) {
        console.log('❌ projectService.deleteProject - Projeto não encontrado:', id);
        return null;
      }
      
      console.log('✅ projectService.deleteProject - Projeto encontrado:', project.name);
      
      // Verificar se há tasks relacionadas (não concluídas)
      const relatedTasks = await prisma.task.findMany({
        where: { 
          projectId: id,
          isCompleted: false // Apenas tasks não concluídas
        },
        take: 1 // Apenas verificar se existe pelo menos uma
      });
      
      if (relatedTasks.length > 0) {
        console.log('⚠️ projectService.deleteProject - Projeto tem tasks não concluídas:', relatedTasks.length);
        // Não impedir exclusão, apenas logar
      }
      
      // Soft delete: set ativo = false, status = false
      const deletedProject = await prisma.project.update({
        where: { id },
        data: {
          ativo: false,
          status: false,
          updatedAt: new Date()
        }
      });
      
      console.log('✅ projectService.deleteProject - Projeto marcado como inativo:', deletedProject.id);
      return deletedProject;
      
    } catch (error) {
      console.error('❌ projectService.deleteProject - Erro ao excluir projeto:', error);
      
      // Tratar erros específicos do Prisma
      if (error.code === 'P2025') {
        // Registro não encontrado
        console.log('❌ projectService.deleteProject - Projeto não encontrado (P2025):', id);
        return null;
      }
      
      if (error.code === 'P2003') {
        // Violação de chave estrangeira
        console.error('❌ projectService.deleteProject - Violação de chave estrangeira:', error);
        throw new Error('Cannot delete project due to foreign key constraints. Related data must be deleted first.');
      }
      
      // Repassar outros erros
      throw error;
    }
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