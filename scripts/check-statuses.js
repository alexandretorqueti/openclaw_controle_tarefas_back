const { PrismaClient } = require('@prisma/client');

async function checkStatuses() {
  const prisma = new PrismaClient();
  
  try {
    const count = await prisma.status.count();
    console.log(`Total de statuses no banco: ${count}`);
    
    const statuses = await prisma.status.findMany({
      orderBy: { order: 'asc' }
    });
    
    console.log('\nStatus cadastrados:');
    console.log(JSON.stringify(statuses, null, 2));
    
    prisma.$disconnect();
  } catch (error) {
    console.error('Erro:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkStatuses();