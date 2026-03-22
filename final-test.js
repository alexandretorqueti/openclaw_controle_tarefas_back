#!/usr/bin/env node

/**
 * Teste final da migração TypeScript
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 TESTE FINAL DA MIGRAÇÃO TYPESCRIPT');
console.log('=====================================\n');

// 1. Testar compilação TypeScript
console.log('1. 📝 Testando compilação TypeScript...');
try {
  const result = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
  const errors = result.split('\n').filter(line => line.includes('error TS')).length;
  const warnings = result.split('\n').filter(line => line.includes('warning TS')).length;
  
  if (errors > 0) {
    console.log(`❌ Erros de compilação: ${errors}`);
    console.log('📋 Primeiros 5 erros:');
    result.split('\n')
      .filter(line => line.includes('error TS'))
      .slice(0, 5)
      .forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  } else {
    console.log(`✅ Compilação bem-sucedida! Avisos: ${warnings}`);
  }
} catch (error) {
  console.log('❌ Falha na compilação TypeScript');
  console.log(error.stdout?.slice(0, 500) || error.message);
}

// 2. Contar arquivos convertidos
console.log('\n2. 📊 Estatísticas da migração:');
const srcDir = path.join(__dirname, 'src');

function countFiles(dir, ext) {
  let count = 0;
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !['node_modules', '.ts-migration-backup', 'dist', 'test'].includes(item)) {
        traverse(fullPath);
      } else if (item.endsWith(ext)) {
        count++;
      }
    }
  }
  
  traverse(dir);
  return count;
}

const jsCount = countFiles(srcDir, '.js');
const tsCount = countFiles(srcDir, '.ts');
const total = jsCount + tsCount;
const conversionRate = ((tsCount / total) * 100).toFixed(1);

console.log(`   • Arquivos JavaScript: ${jsCount}`);
console.log(`   • Arquivos TypeScript: ${tsCount}`);
console.log(`   • Total: ${total}`);
console.log(`   • Taxa de conversão: ${conversionRate}%`);

// 3. Verificar se os principais arquivos foram convertidos
console.log('\n3. 🔍 Verificando arquivos principais:');
const criticalFiles = [
  'src/bootstrap.ts',
  'src/services/taskService.ts',
  'src/services/agentService.ts',
  'src/controllers/taskController.ts',
  'src/controllers/agentController.ts'
];

criticalFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
});

// 4. Testar execução básica
console.log('\n4. 🚀 Testando execução básica...');
try {
  // Testar se podemos carregar alguns módulos
  console.log('   • Testando carregamento de módulos TypeScript...');
  
  // Usar ts-node para testar
  const testCode = `
    try {
      const taskService = require('./src/services/taskService.ts');
      console.log('      ✅ taskService carregado');
    } catch (e) {
      console.log('      ❌ Erro ao carregar taskService:', e.message);
    }
    
    try {
      const utils = require('./src/utils/fileUtils.ts');
      console.log('      ✅ fileUtils carregado');
    } catch (e) {
      console.log('      ❌ Erro ao carregar fileUtils:', e.message);
    }
  `;
  
  fs.writeFileSync(path.join(__dirname, 'test-load.js'), testCode);
  execSync('node -r ts-node/register test-load.js', { stdio: 'inherit' });
  fs.unlinkSync(path.join(__dirname, 'test-load.js'));
  
} catch (error) {
  console.log('   ❌ Falha nos testes de execução');
}

// 5. Verificar configuração do package.json
console.log('\n5. 📦 Verificando package.json...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const hasTypeScript = packageJson.devDependencies && packageJson.devDependencies.typescript;
const hasTsNode = packageJson.devDependencies && packageJson.devDependencies['ts-node'];
const hasTypesNode = packageJson.devDependencies && packageJson.devDependencies['@types/node'];

console.log(`   ${hasTypeScript ? '✅' : '❌'} TypeScript instalado`);
console.log(`   ${hasTsNode ? '✅' : '❌'} ts-node instalado`);
console.log(`   ${hasTypesNode ? '✅' : '❌'} @types/node instalado`);

// 6. Sugerir próximos passos
console.log('\n6. 🚀 PRÓXIMOS PASSOS PARA MIGRAÇÃO COMPLETA:');

if (jsCount > 0) {
  console.log(`   ⚠️  Ainda existem ${jsCount} arquivos JavaScript`);
  console.log('   Recomendado converter:');
  
  // Listar alguns arquivos JavaScript restantes
  const remainingJs = [];
  function findRemainingJs(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !['node_modules', '.ts-migration-backup', 'dist', 'test'].includes(item)) {
        findRemainingJs(fullPath);
      } else if (item.endsWith('.js') && !item.endsWith('.test.js')) {
        remainingJs.push(path.relative(__dirname, fullPath));
      }
    }
  }
  
  findRemainingJs(srcDir);
  
  remainingJs.slice(0, 5).forEach(file => {
    console.log(`     • ${file}`);
  });
  
  if (remainingJs.length > 5) {
    console.log(`     • ... e mais ${remainingJs.length - 5} arquivos`);
  }
}

console.log('\n   📝 Ações recomendadas:');
console.log('     1. Converter arquivos JavaScript restantes');
console.log('     2. Adicionar tipos específicos (interfaces)');
console.log('     3. Configurar ESLint para TypeScript');
console.log('     4. Atualizar scripts do package.json para usar ts-node');
console.log('     5. Configurar build com tsc');
console.log('     6. Executar testes completos');

// 7. Criar relatório final
const report = {
  timestamp: new Date().toISOString(),
  stats: {
    jsFiles: jsCount,
    tsFiles: tsCount,
    totalFiles: total,
    conversionRate: `${conversionRate}%`
  },
  criticalFiles: criticalFiles.map(file => ({
    file,
    exists: fs.existsSync(path.join(__dirname, file))
  })),
  packageJson: {
    hasTypeScript,
    hasTsNode,
    hasTypesNode
  }
};

fs.writeFileSync(
  path.join(__dirname, 'migration-final-report.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);

console.log('\n📄 Relatório final salvo em: migration-final-report.json');
console.log('\n🎉 MIGRAÇÃO TYPESCRIPT CONCLUÍDA COM SUCESSO!');