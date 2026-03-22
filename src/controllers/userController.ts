// Migrado para TypeScript - Fase: Controllers
// Arquivo: userController.js

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import ErrorMiddleware from '../middlewares/errorMiddleware';
import { getAbsoluteAvatarUrl } from '../utils/avatarUrl';
import taskService from '../services/taskService';

class UserController {
  // Get all users
  getAllUsers = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const users = await prisma.user.findMany({
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    // Convert relative avatar URLs to absolute URLs
    const usersWithAbsoluteUrls = users.map(user => ({
      ...user,
      avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl)
    }));
    
    res.json({
      count: users.length,
      users: usersWithAbsoluteUrls,
      correlationId: req.correlationId
    });
  });

  // Get user by ID
  getUserById = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      const error = new Error(`User with ID ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    }
    
    // Convert relative avatar URL to absolute URL
    const userWithAbsoluteUrl = {
      ...user,
      avatarUrl: this.getAbsoluteAvatarUrl(req, user.avatarUrl)
    };
    
    res.json({
      ...userWithAbsoluteUrl,
      correlationId: req.correlationId
    });
  });

  // Get current user (from session)
  getCurrentUser = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    if (!req.session.userId) {
      const error = new Error('Not authenticated');
      (error as any).statusCode = 401;
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      const error = new Error('User not found');
      (error as any).statusCode = 404;
      throw error;
    }
    
    res.json({
      ...user,
      correlationId: req.correlationId
    });
  });

  // Create a new user
  createUser = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { name, email, avatarUrl, role = 'Viewer', nickname } = req.body;
    
    if (!name || !email) {
      const error = new Error('Name and email are required');
      (error as any).statusCode = 400;
      throw error;
    }

    // Generate nickname from email if not provided
    let finalNickname = nickname;
    if (!finalNickname) {
      finalNickname = email.split('@')[0];
    }

    // Check if email already exists
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUserByEmail) {
      const error = new Error('User with this email already exists');
      (error as any).statusCode = 400;
      throw error;
    }

    // Check if nickname already exists
    const existingUserByNickname = await prisma.user.findUnique({
      where: { nickname: finalNickname }
    });
    
    if (existingUserByNickname) {
      const error = new Error('User with this nickname already exists');
      (error as any).statusCode = 400;
      throw error;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        nickname: finalNickname,
        avatarUrl,
        role
      },
      select: {
        id: true,
        name: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    // Convert relative avatar URL to absolute URL
    const userWithAbsoluteUrl = {
      ...user,
      avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl)
    };
    
    res.status(201).json({
      message: 'User created successfully',
      user: userWithAbsoluteUrl,
      correlationId: req.correlationId
    });
  });

  // Update user
  updateUser = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const { name, email, avatarUrl, role, nickname } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!existingUser) {
      const error = new Error(`User with ID ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    // Check if email is being changed and if it already exists
    if (email && email !== existingUser.email) {
      const userWithEmail = await prisma.user.findUnique({
        where: { email }
      });
      
      if (userWithEmail) {
        const error = new Error('Email already in use by another user');
        (error as any).statusCode = 400;
        throw error;
      }
    }

    // Check if nickname is being changed and if it already exists
    if (nickname && nickname !== existingUser.nickname) {
      const userWithNickname = await prisma.user.findUnique({
        where: { nickname }
      });
      
      if (userWithNickname) {
        const error = new Error('Nickname already in use by another user');
        (error as any).statusCode = 400;
        throw error;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        nickname,
        avatarUrl,
        role
      },
      select: {
        id: true,
        name: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    // Convert relative avatar URL to absolute URL
    const userWithAbsoluteUrl = {
      ...updatedUser,
      avatarUrl: getAbsoluteAvatarUrl(req, updatedUser.avatarUrl)
    };
    
    res.json({
      message: 'User updated successfully',
      user: userWithAbsoluteUrl,
      correlationId: req.correlationId
    });
  });

  // Delete user
  deleteUser = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!existingUser) {
      const error = new Error(`User with ID ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    // Check if user has created any projects
    const userProjects = await prisma.project.findFirst({
      where: { createdById: id }
    });
    
    if (userProjects) {
      const error = new Error('Cannot delete user who has created projects');
      (error as any).statusCode = 400;
      throw error;
    }

    // Check if user has created any tasks
    const userTasks = await prisma.task.findFirst({
      where: { createdById: id }
    });
    
    if (userTasks) {
      const error = new Error('Cannot delete user who has created tasks');
      (error as any).statusCode = 400;
      throw error;
    }

    // Check if user is assigned to any tasks
    const assignedTasks = await prisma.task.findFirst({
      where: { assignedToId: id }
    });
    
    if (assignedTasks) {
      const error = new Error('Cannot delete user who is assigned to tasks');
      (error as any).statusCode = 400;
      throw error;
    }

    await prisma.user.delete({
      where: { id }
    });
    
    res.json({
      message: 'User deleted successfully',
      correlationId: req.correlationId
    });
  });

  // Get next task for a user by nickname
  getNextTaskByNickname = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { nickname } = req.params;

    // 1. Find the user
    const user = await prisma.user.findUnique({
      where: { nickname }
    });

    if (!user) {
      const error = new Error(`User with nickname ${nickname} not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    // Usamos o taskService, método getNextTaskForUser
    const nextTask = await taskService.getNextTaskForUser(nickname);

    if (!nextTask) {
      return res.json({
        success: false,
        task: null,
        correlationId: req.correlationId
      });
    }

    return res.json({
      success: true,
      task: nextTask,
      correlationId: req.correlationId
    });
  });

  // Upload avatar for user
  uploadAvatar = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { userId } = req.body;
    
    if (!userId) {
      const error = new Error('User ID is required');
      (error as any).statusCode = 400;
      throw error;
    }

    if (!req.file) {
      const error = new Error('No file uploaded');
      (error as any).statusCode = 400;
      throw error;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      const error = new Error(`User with ID ${userId} not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    // Generate avatar URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.__filename}`;

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        name: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      user: updatedUser,
      avatarUrl: avatarUrl,
      correlationId: req.correlationId
    });
  });
}

export default new UserController();