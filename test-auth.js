const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log('1. Testando conexão com banco...');
    await prisma.$connect();
    console.log('✅ Conexão OK');
    
    console.log('2. Buscando usuário "alexandre"...');
    const user = await prisma.user.findFirst({
      where: {
        nickname: {
          equals: 'alexandre',
          mode: 'insensitive'
        }
      }
    });
    
    if (user) {
      console.log(`✅ Usuário encontrado: ${user.nickname} (ID: ${user.id})`);
    } else {
      console.log('❌ Usuário não encontrado');
    }
    
    console.log('3. Criando novo usuário de teste...');
    const newUser = await prisma.user.create({
      data: {
        name: 'Test User',
        nickname: 'testuser_' + Date.now(),
        role: 'Viewer',
        email: null
      }
    });
    console.log(`✅ Usuário criado: ${newUser.nickname} (ID: ${newUser.id})`);
    
    console.log('4. Atualizando usuário...');
    const updatedUser = await prisma.user.update({
      where: { id: newUser.id },
      data: { updatedAt: new Date() }
    });
    console.log(`✅ Usuário atualizado: ${updatedUser.updatedAt}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Conexão fechada');
  }
}

testAuth();
