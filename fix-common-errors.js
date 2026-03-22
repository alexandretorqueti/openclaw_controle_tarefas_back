#!/usr/bin/env node

/**
 * Correção de erros comuns após migração TypeScript
 */

const fs = require('fs');
const path = require('path');

// Problemas comuns e soluções
const COMMON_FIXES = [
  {
    name: 'Arquivo não é módulo (export default faltando)',
    pattern: /^([\s\S]*?)(module\.exports\s*=\s*{[\s\S]*?})([\s\S]*)$/,
    replacement: (match, before, exportsBlock, after) => {
      // Converter module.exports = { ... } para export { ... }
      const fixedExports = exportsBlock
        .replace('module.exports = {', 'export {')
        .replace(/^\s*(\w+):/gm, '  $1:');
      
      return before + fixedExports + after + '\n\nexport default ' + exportsBlock.match(/\{[\s\S]*?\}/)[0] + ';';
    }
  },
  {
    name: 'Variáveis duplicadas (mover para escopo de função)',
    pattern: /(const|let|var)\s+(\w+)\s*=\s*([^;]+);\s*(?:const|let|var)\s+\2\s*=/g,
    replacement: '$1 $2 = $3;\n$2 ='
  },
  {
    name: 'filename para __filename',
    pattern: /filename(?!\w)/g,
    replacement: '__filename'
  },
  {
    name: 'Error.code para (error as any).code',
    pattern: /error\.code/g,
    replacement: '(error as any).code'
  },
  {
    name: 'Error.statusCode para (error as any).statusCode',
    pattern: /error\.statusCode/g,
    replacement: '(error as any).statusCode'
  },
  {
    name: 'Adicionar import type para PrismaClient',
    pattern: /import\s+{\s*PrismaClient\s*}\s+from\s+['"]@prisma\/client['"];/,
    replacement: 'import type { PrismaClient } from \'@prisma/client\';'
  }
];

// Encontrar todos os arquivos TypeScript
function findTsFiles() {
  const files = [];
  
  function traverse(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !['node_modules', '.ts-migration-backup', 'dist', 'test'].includes(item)) {
        traverse(fullPath);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(path.join(__dirname, 'src'));
  return files;
}

// Aplicar correções a um arquivo
function applyFixesToFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let fixesApplied = 0;
    
    // Aplicar cada correção
    COMMON_FIXES.forEach((fix, index) => {
      const newContent = content.replace(fix.pattern, fix.replacement);
      if (newContent !== content) {
        content = newContent;
        fixesApplied++;
        console.log(`  ✅ Aplicada correção: ${fix.name}`);
      }
    });
    
    // Correção especial para exports
    if (content.includes('module.exports = {')) {
      // Tentar converter para export
      content = content.replace(
        /module\.exports\s*=\s*{([\s\S]*?)};/,
        'export {$1};'
      );
      fixesApplied++;
      console.log(`  ✅ Convertido module.exports para export`);
    }
    
    // Se houve mudanças, salvar
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return fixesApplied;
    }
    
    return 0;
  } catch (error) {
    console.error(`  ❌ Erro ao processar ${filePath}:`, error.message);
    return 0;
  }
}

// Correções específicas para arquivos problemáticos
function applySpecificFixes() {
  console.log('\n🔧 Aplicando correções específicas...');
  
  // 1. Corrigir bootstrap.js (ainda JavaScript)
  const bootstrapPath = path.join(__dirname, 'src', 'bootstrap.js');
  if (fs.existsSync(bootstrapPath)) {
    let content = fs.readFileSync(bootstrapPath, 'utf8');
    
    // Atualizar imports para .ts
    content = content.replace(/require\('\.\/([^']+)\.js'\)/g, (match, moduleName) => {
      const tsPath = path.join(__dirname, 'src', moduleName + '.ts');
      if (fs.existsSync(tsPath)) {
        return `require('./${moduleName}.ts')`;
      }
      return match;
    });
    
    fs.writeFileSync(bootstrapPath, content, 'utf8');
    console.log('✅ bootstrap.js atualizado para importar .ts');
  }
  
  // 2. Corrigir imports relativos faltando ./
  const tsFiles = findTsFiles();
  tsFiles.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Corrigir imports sem ./
    content = content.replace(/from\s+['"]([^.'"][^'"]*)['"]/g, (match, modulePath) => {
      // Se não começa com . ou /, provavelmente é relativo
      if (!modulePath.startsWith('.') && !modulePath.startsWith('/') && !modulePath.startsWith('@')) {
        changed = true;
        return `from "./${modulePath}"`;
      }
      return match;
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${path.relative(__dirname, filePath)} - imports corrigidos`);
    }
  });
}

function main() {
  console.log('🔧 CORREÇÃO DE ERROS COMUNS TYPESCRIPT');
  console.log('======================================\n');
  
  // Encontrar arquivos
  const tsFiles = findTsFiles();
  console.log(`📊 Arquivos TypeScript encontrados: ${tsFiles.length}`);
  
  let totalFixes = 0;
  let filesFixed = 0;
  
  // Aplicar correções gerais
  console.log('\n🔄 Aplicando correções gerais...');
  tsFiles.forEach((filePath, index) => {
    const relativePath = path.relative(__dirname, filePath);
    console.log(`\n${index + 1}/${tsFiles.length}: ${relativePath}`);
    
    const fixes = applyFixesToFile(filePath);
    if (fixes > 0) {
      totalFixes += fixes;
      filesFixed++;
    }
  });
  
  // Aplicar correções específicas
  applySpecificFixes();
  
  // Resumo
  console.log('\n🎉 RESUMO DAS CORREÇÕES');
  console.log('======================\n');
  console.log(`✅ Arquivos corrigidos: ${filesFixed}/${tsFiles.length}`);
  console.log(`✅ Total de correções aplicadas: ${totalFixes}`);
  
  // Testar compilação
  console.log('\n🧪 Testando compilação...');
  try {
    const { execSync } = require('child_process');
    const result = execSync('npx tsc --noEmit 2>&1 | head -20', { encoding: 'utf8' });
    
    if (result.trim()) {
      console.log('📋 Erros restantes:');
      console.log(result);
    } else {
      console.log('✅ Nenhum erro de compilação!');
    }
  } catch (error) {
    console.log('📋 Erros de compilação:');
    console.log((error.stdout || error.message).slice(0, 500));
  }
  
  console.log('\n🚀 Próximos passos:');
  console.log('1. Corrigir erros restantes manualmente');
  console.log('2. Converter bootstrap.js e server.js para TypeScript');
  console.log('3. Atualizar monitor.js para usar TypeScript');
  console.log('4. Configurar build no package.json');
}

if (require.main === module) {
  main();
}