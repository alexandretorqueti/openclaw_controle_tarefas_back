const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const statuses = await prisma.status.findMany({ select: { id: true, name: true } });
  const priorities = await prisma.priority.findMany({ select: { id: true, name: true } });
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  console.log('Projects:', projects.length);
  console.log('Statuses:', statuses.length);
  console.log('Priorities:', priorities.length);
  console.log('Users:', users.length);
  if (projects.length && statuses.length && priorities.length && users.length) {
    console.log('First project:', projects[0]);
    console.log('First status:', statuses[0]);
    console.log('First priority:', priorities[0]);
    console.log('First user:', users[0]);
  } else {
    console.log('Missing data');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());