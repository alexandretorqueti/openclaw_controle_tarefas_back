const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testando criação de usuário...');
    
    const newUser = await prisma.user.create({
      data: {
        name: 'Test User ' + Date.now(),
        role: 'Viewer'
      }
    });
    
    console.log('✅ Usuário criado:', newUser.name, '(ID:', newUser.id + ')');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    if (error.code) console.error('Código:', error.code);
    if (error.meta) console.error('Meta:', error.meta);
  } finally {
    await prisma.$disconnect();
  }
}

test();
