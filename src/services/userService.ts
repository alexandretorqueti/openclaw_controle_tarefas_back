// Migrado para TypeScript - Fase: Services
// Arquivo: userService.js

export import prisma from "./prismaService";

class UserService {
  // Get all users
  async getAllUsers(): Promise<any> {
    return await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  // Get user by ID
  async getUserById(id): Promise<any> {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  // Get user by email
  async getUserByEmail(email): Promise<any> {
    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  // Get user by nickname
  async getUserByNickname(nickname): Promise<any> {
    return await prisma.user.findUnique({
      where: { nickname },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }
}

export default new UserService();