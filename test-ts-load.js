
    console.log('   • Carregando ts-node...');
    require('ts-node/register');
    console.log('   ✅ ts-node carregado');
    
    console.log('   • Testando módulos TypeScript...');
    const utils = require('./src/utils/avatarUrl.ts');
    console.log('   ✅ utils/avatarUrl carregado');
    
    const services = require('./src/services/taskService.ts');
    console.log('   ✅ services/taskService carregado');
    
    console.log('\n🎉 TUDO FUNCIONANDO!');
  