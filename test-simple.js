const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testando query simples...');
    
    // Teste 1: Buscar usuário existente
    const user = await prisma.user.findFirst({
      where: { nickname: 'alexandre' }
    });
    
    console.log('Usuário encontrado:', user ? user.nickname : 'Nenhum');
    
    // Teste 2: Criar novo usuário
    const newUser = await prisma.user.create({
      data: {
        name: 'Test Simple',
        nickname: 'testsimple_' + Date.now(),
        role: 'Viewer'
      }
    });
    console.log('Novo usuário criado:', newUser.nickname);
    
  } catch (error) {
    console.error('ERRO:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();
