import { Project, Prisma } from '@prisma/client';
import prisma from './prismaService';
const sseService = require('./sseService');

class ProjectService {
  async createProject(data: any): Promise<Project> {
    return await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        regras: data.regras || null,
        status: data.status !== undefined ? data.status : true,
        ativo: data.ativo !== undefined ? data.ativo : true,
        createdById: data.createdById,
        projectTypeId: data.projectTypeId || null,
        frontendPath: data.frontendPath || null,
        frontendPort: data.frontendPort || null,
        backendPath: data.backendPath || null,
        backendPort: data.backendPort || null,
        repositoryUrl: data.repositoryUrl || null,
        pastaBase: data.pastaBase || null,
        agent: data.agent || null,
        programadorFront: data.programadorFront || null,
        programadorBack: data.programadorBack || null,
        modeloAuxiliar: data.modeloAuxiliar || null,
        frontendBuildCmd: data.frontendBuildCmd || null,
        backendBuildCmd: data.backendBuildCmd || null,
        frontendTestCommand: data.frontendTestCommand || null,
        backendTestCommand: data.backendTestCommand || null
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

  async getAllProjects(options: { sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}): Promise<any[]> {
    const { sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    const validSortFields = ['createdAt', 'updatedAt', 'name'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

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

  async getProjectById(id: string): Promise<any | null> {
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

  async updateProject(id: string, data: any): Promise<Project> {
    const updateData: any = {
      name: data.name,
      description: data.description,
      regras: data.regras,
      status: data.status,
      ativo: data.ativo,
      updatedAt: new Date()
    };
    
    if (data.projectTypeId !== undefined) updateData.projectTypeId = data.projectTypeId;
    if (data.frontendPath !== undefined) updateData.frontendPath = data.frontendPath || null;
    if (data.frontendPort !== undefined) updateData.frontendPort = data.frontendPort || null;
    if (data.backendPath !== undefined) updateData.backendPath = data.backendPath || null;
    if (data.backendPort !== undefined) updateData.backendPort = data.backendPort || null;
    if (data.repositoryUrl !== undefined) updateData.repositoryUrl = data.repositoryUrl || null;
    if (data.pastaBase !== undefined) updateData.pastaBase = data.pastaBase || null;
    if (data.agent !== undefined) updateData.agent = data.agent || null;
    if (data.programadorFront !== undefined) updateData.programadorFront = data.programadorFront || null;
    if (data.programadorBack !== undefined) updateData.programadorBack = data.programadorBack || null;
    if (data.modeloAuxiliar !== undefined) updateData.modeloAuxiliar = data.modeloAuxiliar || null;
    if (data.frontendBuildCmd !== undefined) updateData.frontendBuildCmd = data.frontendBuildCmd || null;
    if (data.backendBuildCmd !== undefined) updateData.backendBuildCmd = data.backendBuildCmd || null;
    if (data.frontendTestCommand !== undefined) updateData.frontendTestCommand = data.frontendTestCommand || null;
    if (data.backendTestCommand !== undefined) updateData.backendTestCommand = data.backendTestCommand || null;
    
    const updatedProject = await prisma.project.update({
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
    
    sseService.broadcast('project_updated', updatedProject);
    
    return updatedProject;
  }

  async deleteProject(id: string): Promise<Project | null> {
    try {
      const project = await prisma.project.findUnique({
        where: { id }
      });
      
      if (!project) {
        return null;
      }
      
      const deletedProject = await prisma.project.update({
        where: { id },
        data: {
          ativo: false,
          status: false,
          updatedAt: new Date()
        }
      });
      
      return deletedProject;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') return null;
        if (error.code === 'P2003') {
           throw new Error('Cannot delete project due to foreign key constraints.');
        }
      }
      throw error;
    }
  }

  async getProjectStatistics(id: string): Promise<any> {
    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      select: {
        id: true,
        isCompleted: true,
        deadline: true,
        status: { select: { name: true } },
        priority: { select: { name: true } }
      }
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const overdueTasks = tasks.filter(t => 
      !t.isCompleted && new Date(t.deadline) < new Date()
    ).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const statusCounts: Record<string, number> = {};
    tasks.forEach(task => {
      const statusName = task.status.name;
      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
    });

    const priorityCounts: Record<string, number> = {};
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

export default new ProjectService();
