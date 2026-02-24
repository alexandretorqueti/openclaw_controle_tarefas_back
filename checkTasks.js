const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    select: { id: true, title: true, isCompleted: true, projectId: true },
    take: 10,
  });
  console.log('Tasks:', JSON.stringify(tasks, null, 2));
  const count = await prisma.task.count();
  console.log('Total tasks:', count);
}

main().catch(console.error).finally(() => prisma.$disconnect());