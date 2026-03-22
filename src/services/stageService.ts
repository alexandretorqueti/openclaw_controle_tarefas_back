// Migrado para TypeScript - Fase: Services
// Arquivo: stageService.js

export import prisma from "./prismaService";

class StageService {
  async getAll(): Promise<any> {
    return await prisma.stage.findMany({
      orderBy: { etapa: 'asc' }
    });
  }

  async getById(id): Promise<any> {
    return await prisma.stage.findUnique({ where: { id } });
  }

  async create(data): Promise<any> {
    return await prisma.stage.create({ data });
  }

  async update(id, data): Promise<any> {
    return await prisma.stage.update({
      where: { id },
      data
    });
  }

  async delete(id): Promise<any> {
    return await prisma.stage.delete({ where: { id } });
  }
}

export default new StageService();