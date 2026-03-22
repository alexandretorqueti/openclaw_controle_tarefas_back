#!/usr/bin/env node

/**
 * Migração inteligente por fases
 * Converte categorias específicas com correções personalizadas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Fases de migração (ordem de dependência)
const PHASES = [
  {
    name: 'Utils',
    dir: 'src/utils',
    priority: 1,
    fixImports: true,
    fixExports: true
  },
  {
    name: 'Services',
    dir: 'src/services',
    priority: 2,
    fixImports: true,
    fixExports: true,
    customFixes: ['taskService', 'agentService']
  },
  {
    name: 'Controllers',
    dir: 'src/controllers',
    priority: 3,
    fixImports: true,
    fixExports: false, // Muitos usam module.exports
    skip: ['server.js'] // Manter como JS por enquanto
  },
  {
    name: 'Steps',
    dir: 'src/steps',
    priority: 4,
    fixImports: true,
    fixExports: true
  },
  {
    name: 'Adapters',
    dir: 'src/steps/adapters',
    priority: 5,
    fixImports: true,
    fixExports: true
  },
  {
    name: 'Core',
    dir: 'src',
    files: ['container.js', 'bootstrap.js'],
    priority: 6,
    fixImports: true,
    fixExports: true
  }
];

// Estatísticas
const stats = {
  phases: {},
  totalConverted: 0,
  totalErrors: 0
};

// Função para converter um arquivo com correções
function convertWithFixes(jsPath, phase) {
  const dir = path.dirname(jsPath);
  const fileName = path.basename(jsPath);
  const tsPath = path.join(dir, fileName.replace(/\.js$/, '.ts'));
  
  // Pular se já existe
  if (fs.existsSync(tsPath)) {
    return { converted: false, error: null };
  }
  
  try {
    let content = fs.readFileSync(jsPath, 'utf8');
    
    // Aplicar correções baseadas na fase
    content = applyPhaseFixes(content, jsPath, phase);
    
    // Escrever arquivo TypeScript
    fs.writeFileSync(tsPath, content, 'utf8');
    
    // Backup
    const backupPath = jsPath + '.bak';
    fs.copyFileSync(jsPath, backupPath);
    
    return { converted: true, error: null };
  } catch (error) {
    return { converted: false, error: error.message };
  }
}

// Aplicar correções específicas por fase
function applyPhaseFixes(content, filePath, phase) {
  let fixed = content;
  const fileName = path.basename(filePath);
  
  // 1. Correções para utils/
  if (phase.dir.includes('utils')) {
    // Utils geralmente exportam funções individuais
    fixed = fixed.replace(/module\.exports\s*=\s*{/g, 'export {');
    fixed = fixed.replace(/^\s*(\w+):/gm, '  $1:');
  }
  
  // 2. Correções para services/
  if (phase.dir.includes('services')) {
    // Services geralmente são classes ou objetos
    if (fileName.includes('Service')) {
      // Se é uma classe, manter como está
      if (fixed.includes('class ')) {
        // Adicionar export antes da classe
        if (!fixed.startsWith('export')) {
          fixed = 'export ' + fixed;
        }
      } else {
        // Objeto literal - converter para export
        fixed = fixed.replace(/module\.exports\s*=\s*{/g, 'export {');
      }
    }
  }
  
  // 3. Correções para controllers/
  if (phase.dir.includes('controllers')) {
    // Controllers geralmente exportam funções individuais
    // Manter module.exports para compatibilidade
    // Apenas adicionar tipos
  }
  
  // 4. Correções gerais de imports
  if (phase.fixImports) {
    // Converter require para import (apenas para módulos locais .js)
    fixed = fixed.replace(
      /const\s+(\w+)\s*=\s*require\(['"]\.\.?\/([^'"]+)['"]\);/g,
      (match, varName, modulePath) => {
        // Se o módulo já foi convertido para .ts, atualizar caminho
        const fullPath = path.join(path.dirname(filePath), modulePath);
        const tsPath = fullPath.replace(/\.js$/, '.ts');
        const jsPath = fullPath + '.js';
        
        if (fs.existsSync(tsPath)) {
          return `import ${varName} from "${modulePath.replace(/\.js$/, '.ts')}";`;
        } else if (fs.existsSync(jsPath)) {
          return `import ${varName} from "${modulePath}";`;
        }
        return match; // Manter como está
      }
    );
  }
  
  // 5. Adicionar tipos básicos para funções
  fixed = addBasicTypes(fixed);
  
  // 6. Adicionar cabeçalho
  fixed = `// Migrado para TypeScript - Fase: ${phase.name}\n// Arquivo: ${fileName}\n\n${fixed}`;
  
  return fixed;
}

// Adicionar tipos básicos
function addBasicTypes(content) {
  let typed = content;
  
  // Funções nomeadas
  typed = typed.replace(
    /function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
    (match, funcName, params) => {
      if (!params.trim()) return `function ${funcName}(): any {`;
      
      // Verificar se já tem tipos
      if (params.includes(':')) return match;
      
      // Adicionar tipos any
      const typedParams = params.split(',').map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        
        // Já tem tipo ou valor padrão?
        if (trimmed.includes(':') || trimmed.includes('=')) {
          return trimmed;
        }
        
        // Adicionar : any
        return `${trimmed}: any`;
      }).filter(p => p).join(', ');
      
      return `function ${funcName}(${typedParams}): any {`;
    }
  );
  
  // Arrow functions atribuídas a const
  typed = typed.replace(
    /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g,
    (match, varName, params) => {
      if (!params.trim()) return `const ${varName} = (): any =>`;
      
      if (params.includes(':')) return match;
      
      const typedParams = params.split(',').map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.includes(':') || trimmed.includes('=')) {
          return trimmed;
        }
        return `${trimmed}: any`;
      }).filter(p => p).join(', ');
      
      return `const ${varName} = (${typedParams}): any =>`;
    }
  );
  
  return typed;
}

// Executar uma fase
function runPhase(phase) {
  console.log(`\n🎯 Fase: ${phase.name}`);
  console.log('='.repeat(30));
  
  stats.phases[phase.name] = {
    converted: 0,
    errors: 0,
    files: []
  };
  
  // Encontrar arquivos para esta fase
  let jsFiles = [];
  
  if (phase.files) {
    // Arquivos específicos
    jsFiles = phase.files.map(f => path.join(__dirname, f));
  } else if (phase.dir) {
    // Diretório completo
    const phaseDir = path.join(__dirname, phase.dir);
    
    if (!fs.existsSync(phaseDir)) {
      console.log(`⚠️  Diretório não encontrado: ${phase.dir}`);
      return;
    }
    
    // Encontrar todos os .js no diretório
    function findInDir(dir) {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          findInDir(fullPath);
        } else if (item.endsWith('.js') && !item.endsWith('.test.js') && !item.endsWith('.spec.js')) {
          // Verificar se está na lista de skip
          if (phase.skip && phase.skip.includes(item)) {
            console.log(`⏭️  Pulando: ${item}`);
            continue;
          }
          jsFiles.push(fullPath);
        }
      }
    }
    
    findInDir(phaseDir);
  }
  
  console.log(`📁 Arquivos encontrados: ${jsFiles.length}`);
  
  // Converter cada arquivo
  jsFiles.forEach(jsFile => {
    const relativePath = path.relative(__dirname, jsFile);
    
    const result = convertWithFixes(jsFile, phase);
    
    if (result.converted) {
      console.log(`✅ ${relativePath}`);
      stats.phases[phase.name].converted++;
      stats.totalConverted++;
      stats.phases[phase.name].files.push(relativePath);
    } else if (result.error) {
      console.log(`❌ ${relativePath}: ${result.error}`);
      stats.phases[phase.name].errors++;
      stats.totalErrors++;
    }
  });
  
  // Testar compilação após cada fase
  console.log('\n🧪 Testando compilação...');
  try {
    const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
    const errors = output.split('\n').filter(line => line.includes('error TS')).length;
    const warnings = output.split('\n').filter(line => line.includes('warning TS')).length;
    
    console.log(`📊 Erros: ${errors}, Avisos: ${warnings}`);
    
    if (errors > 0) {
      // Mostrar erros relacionados a esta fase
      const phaseErrors = output.split('\n')
        .filter(line => line.includes('error TS'))
        .filter(line => phase.dir ? line.includes(phase.dir) : true)
        .slice(0, 5);
      
      if (phaseErrors.length > 0) {
        console.log('📋 Principais erros desta fase:');
        phaseErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err}`);
        });
      }
    }
  } catch (error) {
    console.log('⚠️  Erro ao testar compilação');
  }
}

// Main
function main() {
  console.log('🧠 MIGRAÇÃO INTELIGENTE TYPESCRIPT');
  console.log('==================================\n');
  
  // Ordenar fases por prioridade
  const sortedPhases = [...PHASES].sort((a, b) => a.priority - b.priority);
  
  // Executar cada fase
  sortedPhases.forEach(phase => {
    runPhase(phase);
  });
  
  // Resumo
  console.log('\n🎉 RESUMO DA MIGRAÇÃO');
  console.log('====================\n');
  
  Object.entries(stats.phases).forEach(([phaseName, phaseStats]) => {
    console.log(`${phaseName}:`);
    console.log(`  ✅ Convertidos: ${phaseStats.converted}`);
    console.log(`  ❌ Erros: ${phaseStats.errors}`);
    
    if (phaseStats.files.length > 0) {
      console.log(`  📁 Arquivos: ${phaseStats.files.slice(0, 3).join(', ')}${phaseStats.files.length > 3 ? '...' : ''}`);
    }
    console.log();
  });
  
  console.log(`📊 TOTAL: ${stats.totalConverted} arquivos convertidos, ${stats.totalErrors} erros`);
  
  // Próximos passos
  console.log('\n🚀 PRÓXIMOS PASSOS:');
  console.log('1. Corrigir erros de import/export');
  console.log('2. Adicionar interfaces para tipos complexos');
  console.log('3. Configurar tsconfig.json mais restrito');
  console.log('4. Atualizar scripts do package.json');
  console.log('5. Executar testes completos');
  
  // Criar arquivo de relatório
  const report = {
    timestamp: new Date().toISOString(),
    stats: stats,
    phases: sortedPhases.map(p => ({
      name: p.name,
      dir: p.dir,
      priority: p.priority
    }))
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'migration-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );
  
  console.log('\n📄 Relatório salvo em: migration-report.json');
}

// Executar
if (require.main === module) {
  main();
}