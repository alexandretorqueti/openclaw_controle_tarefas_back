#!/usr/bin/env node

/**
 * Correção rápida para funções async sem tipo de retorno
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigindo funções async...');

// Encontrar todos os arquivos TypeScript
const tsFiles = [];
function findTsFiles(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !['node_modules', '.ts-migration-backup', 'dist', 'test'].includes(item)) {
      findTsFiles(fullPath);
    } else if (item.endsWith('.ts')) {
      tsFiles.push(fullPath);
    }
  }
}

findTsFiles(path.join(__dirname, 'src'));
console.log(`📁 Arquivos encontrados: ${tsFiles.length}`);

// Corrigir cada arquivo
let fixedCount = 0;
tsFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Corrigir funções async sem tipo de retorno
    // Padrão: async function nome() { ou async (params) => {
    content = content.replace(
      /async\s+function\s+(\w+)\s*\(([^)]*)\)\s*(:\s*\w+)?\s*{/g,
      (match, funcName, params, returnType) => {
        if (!returnType) {
          changed = true;
          return `async function ${funcName}(${params}): Promise<any> {`;
        }
        return match;
      }
    );
    
    // Corrigir arrow functions async
    content = content.replace(
      /async\s*\(([^)]*)\)\s*(:\s*\w+)?\s*=>/g,
      (match, params, returnType) => {
        if (!returnType) {
          changed = true;
          return `async (${params}): Promise<any> =>`;
        }
        return match;
      }
    );
    
    // Corrigir métodos async em classes
    content = content.replace(
      /async\s+(\w+)\s*\(([^)]*)\)\s*(:\s*\w+)?\s*{/g,
      (match, methodName, params, returnType) => {
        // Verificar se é um método (está dentro de uma classe)
        const linesBefore = content.substring(0, content.indexOf(match)).split('\n');
        const classContext = linesBefore.some(line => line.includes('class '));
        
        if (classContext && !returnType) {
          changed = true;
          return `async ${methodName}(${params}): Promise<any> {`;
        }
        return match;
      }
    );
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      fixedCount++;
      console.log(`✅ ${path.relative(__dirname, filePath)}`);
    }
  } catch (error) {
    console.error(`❌ ${filePath}: ${error.message}`);
  }
});

console.log(`\n✅ ${fixedCount} arquivos corrigidos`);

// Testar novamente
console.log('\n🧪 Testando carregamento...');
try {
  const { execSync } = require('child_process');
  execSync('node -e "require(\'ts-node/register\'); console.log(\'✅ ts-node carregado\')"', { stdio: 'inherit' });
} catch (error) {
  console.log('❌ Erro:', error.message);
}