const prisma = require('./prismaService');

class StageService {
  async getAll() {
    return await prisma.stage.findMany({
      orderBy: { etapa: 'asc' }
    });
  }

  async getById(id) {
    return await prisma.stage.findUnique({ where: { id } });
  }

  async create(data) {
    return await prisma.stage.create({ data });
  }

  async update(id, data) {
    return await prisma.stage.update({
      where: { id },
      data
    });
  }

  async delete(id) {
    return await prisma.stage.delete({ where: { id } });
  }
}

module.exports = new StageService();