#!/usr/bin/env node

/**
 * Script de migração pragmática JavaScript → TypeScript
 * Abordagem incremental: converte .js para .ts mantendo funcionalidade
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ordem recomendada para migração (menos dependências primeiro)
const MIGRATION_ORDER = [
  'utils',           // Helpers independentes
  'services',        // Lógica de negócio
  'models',          // Tipos de dados (se houver)
  'controllers',     // Rotas/API
  'middleware',      // Middleware
  'steps',           // Steps do pipeline
  'adapters'         // Adaptadores
];

// Extensões para converter
const JS_EXTENSIONS = ['.js', '.jsx'];
const TS_EXTENSIONS = ['.ts', '.tsx'];

// Configuração
const SRC_DIR = path.join(__dirname, 'src');
const DRY_RUN = false; // false para realmente migrar

function findJsFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (JS_EXTENSIONS.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function convertJsToTs(filePath) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  
  // Determinar extensão TypeScript correta
  let tsExt = '.ts';
  if (fileName.endsWith('.jsx')) {
    tsExt = '.tsx';
  }
  
  const tsFileName = fileName.replace(/\.[^/.]+$/, tsExt);
  const tsFilePath = path.join(dir, tsFileName);
  
  // Ler conteúdo original
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Adicionar comentário TypeScript no topo
  const tsContent = `// Migrado para TypeScript - ${new Date().toISOString()}\n// TODO: Adicionar tipos específicos\n\n${content}`;
  
  if (!DRY_RUN) {
    // Escrever arquivo TypeScript
    fs.writeFileSync(tsFilePath, tsContent, 'utf8');
    console.log(`✅ Convertido: ${filePath} → ${tsFilePath}`);
    
    // Manter arquivo JavaScript original (backup)
    const backupPath = filePath + '.bak';
    fs.copyFileSync(filePath, backupPath);
    
    // Opcional: remover arquivo JavaScript original
    // fs.unlinkSync(filePath);
  } else {
    console.log(`📝 (Dry run) Converteria: ${filePath} → ${tsFilePath}`);
  }
  
  return tsFilePath;
}

function analyzeDependencies(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  
  // Regex simples para imports/requires
  const importRegex = /(?:import|require)\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (importPath && !importPath.startsWith('.') && !importPath.startsWith('/')) {
      imports.push(importPath);
    }
  }
  
  return imports;
}

function getMigrationPriority(filePath) {
  // Priorizar arquivos com menos dependências externas
  const deps = analyzeDependencies(filePath);
  const score = 100 - (deps.length * 10); // Quanto menos dependências, maior prioridade
  
  return {
    filePath,
    dependencies: deps,
    priority: Math.max(score, 0)
  };
}

function main() {
  console.log('🚀 Iniciando migração TypeScript pragmática');
  console.log('===========================================\n');
  
  // Encontrar todos os arquivos JavaScript
  const allJsFiles = findJsFiles(SRC_DIR);
  console.log(`📊 Total de arquivos JavaScript: ${allJsFiles.length}`);
  
  // Analisar prioridades
  const filesWithPriority = allJsFiles.map(getMigrationPriority);
  
  // Ordenar por prioridade (mais alta primeiro)
  filesWithPriority.sort((a, b) => b.priority - a.priority);
  
  console.log('\n📋 Ordem de migração recomendada (top 10):');
  filesWithPriority.slice(0, 10).forEach((file, index) => {
    console.log(`${index + 1}. ${path.relative(SRC_DIR, file.filePath)}`);
    console.log(`   Dependências: ${file.dependencies.length}, Prioridade: ${file.priority}`);
  });
  
  // Migrar por categoria (seguindo ordem definida)
  console.log('\n🔧 Migrando por categoria:');
  
  for (const category of MIGRATION_ORDER) {
    const categoryDir = path.join(SRC_DIR, category);
    
    if (fs.existsSync(categoryDir)) {
      console.log(`\n📁 Processando: ${category}/`);
      
      const categoryFiles = findJsFiles(categoryDir);
      console.log(`   Arquivos: ${categoryFiles.length}`);
      
      // Migrar alguns arquivos de exemplo
      const sampleFiles = categoryFiles.slice(0, 3); // Primeiros 3 de cada categoria
      
      for (const file of sampleFiles) {
        try {
          convertJsToTs(file);
        } catch (error) {
          console.error(`❌ Erro ao migrar ${file}:`, error.message);
        }
      }
    }
  }
  
  // Testar compilação TypeScript
  console.log('\n🧪 Testando compilação TypeScript...');
  try {
    const result = execSync('npx tsc --noEmit 2>&1 | head -20', { encoding: 'utf8' });
    console.log('Saída do TypeScript Compiler:');
    console.log(result);
  } catch (error) {
    console.log('Erros de compilação (esperado na migração inicial):');
    console.log(error.stdout || error.message);
  }
  
  console.log('\n✅ Migração inicial concluída!');
  console.log('\n📝 Próximos passos:');
  console.log('1. Testar se o projeto ainda funciona: npm test');
  console.log('2. Executar servidor: node monitor.js');
  console.log('3. Começar a adicionar tipos específicos nos arquivos .ts');
  console.log('4. Usar `any` inicialmente, depois refinar gradualmente');
  console.log('5. Configurar ESLint para TypeScript');
}

// Executar
if (require.main === module) {
  main();
}

module.exports = { convertJsToTs, analyzeDependencies };