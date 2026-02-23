const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true
    },
    take: 3
  });
  
  console.log('Users:', JSON.stringify(users, null, 2));
  
  const tasks = await prisma.task.findMany({
    select: {
      id: true,
      title: true
    },
    take: 3
  });
  
  console.log('\nTasks:', JSON.stringify(tasks, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());