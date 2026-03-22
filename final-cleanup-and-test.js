#!/usr/bin/env node

/**
 * Script final para aplicar correções e testar migração TypeScript
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = __dirname;
const SRC_DIR = path.join(PROJECT_DIR, 'src');

// Arquivos que precisam de atenção especial (ainda são .js)
const REMAINING_JS_FILES = [
  'bootstrap.js',
  'server.js',
  'monitor.js'
];

function runCommand(command) {
  try {
    console.log(`
▶️ Executando: ${command}`);
    execSync(command, { stdio: 'inherit' });
    console.log('✅ Comando executado com sucesso.');
    return true;
  } catch (error) {
    console.error('❌ Falha ao executar comando:', error.message);
    return false;
  }
}

function convertRemainingJs() {
  console.log('\n🔄 Convertendo arquivos JavaScript restantes para TypeScript...');
  
  for (const file of REMAINING_JS_FILES) {
    const jsPath = path.join(PROJECT_DIR, file);
    const tsPath = path.join(PROJECT_DIR, file.replace('.js', '.ts'));
    
    if (fs.existsSync(jsPath)) {
      try {
        let content = fs.readFileSync(jsPath, 'utf8');
        
        // Adicionar cabeçalho e TODO
        content = `// Migrado para TypeScript\n// TODO: Adicionar tipos específicos\n\n${content}`;
        
        fs.writeFileSync(tsPath, content, 'utf8');
        fs.copyFileSync(jsPath, jsPath + '.bak'); // Backup
        fs.unlinkSync(jsPath); // Remover JS original
        
        console.log(`✅ Convertido: ${file} → ${path.basename(tsPath)}`);
      } catch (error) {
        console.error(`❌ Erro ao converter ${file}:`, error.message);
      }
    } else {
      console.log(`⚠️  Arquivo não encontrado: ${file}`);
    }
  }
}

function updatePackageJson() {
  console.log('\n📦 Atualizando package.json para usar ts-node...');
  const packageJsonPath = path.join(PROJECT_DIR, 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Adicionar ou modificar scripts
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts.start = 'ts-node src/monitor.ts';
    packageJson.scripts.dev = 'ts-node-dev --respawn src/monitor.ts'; // ou outro arquivo principal
    packageJson.scripts.build = 'tsc'; // Adicionar build
    packageJson.scripts.test = 'jest'; // Manter ou adaptar para TS
    
    // Adicionar devDependencies se necessário
    packageJson.devDependencies = packageJson.devDependencies || {};
    packageJson.devDependencies.typescript = '^5.0.0'; // Versão recente
    packageJson.devDependencies['ts-node'] = '^10.9.1';
    packageJson.devDependencies['@types/node'] = '^18.0.0'; // Compatível com ts-node
    packageJson.devDependencies['jest'] = '^29.0.0'; // Ajustar se necessário
    packageJson.devDependencies['@types/jest'] = '^29.0.0';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('✅ package.json atualizado');
    
    // Instalar novas dependências
    runCommand('npm install');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar package.json:', error.message);
  }
}

function finalCompilationCheck() {
  console.log('\n1. 🧐 Verificando compilação final com tsc...');
  try {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('✅ Compilação bem-sucedida!');
    return true;
  } catch (error) {
    console.error('❌ Compilação falhou. Erros precisam ser corrigidos manualmente.');
    console.log('   Execute: npx tsc --noEmit para ver os erros.');
    return false;
  }
}

function runTests() {
  console.log('\n2. 🧪 Executando testes...');
  try {
    // Adaptar comando de teste se necessário (ex: jest --config jest.config.ts)
    execSync('npm test', { stdio: 'inherit' });
    console.log('✅ Testes passaram!');
    return true;
  } catch (error) {
    console.error('❌ Testes falharam!');
    return false;
  }
}

function runServer() {
  console.log('\n3. ▶️ Executando servidor (usando ts-node)...');
  console.log('   AVISO: Isso manterá o processo rodando. Use Ctrl+C para parar.');
  try {
    // Usar ts-node para iniciar o servidor
    execSync('npx ts-node src/monitor.ts', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('❌ Falha ao iniciar o servidor!');
    return false;
  }
}

function main() {
  // Converter arquivos restantes
  convertRemainingJs();
  
  // Atualizar package.json
  updatePackageJson();
  
  // Testar compilação
  const compilationOk = finalCompilationCheck();
  
  // Executar testes se a compilação foi bem-sucedida
  if (compilationOk) {
    runTests();
  }
  
  // Perguntar se quer iniciar o servidor
  console.log('\n❓ Deseja iniciar o servidor agora? (s/N)');
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('> ', (answer) => {
    if (answer.toLowerCase() === 's') {
      runServer();
    } else {
      console.log('\n✅ Servidor não iniciado. Execute `npm start` ou `npx ts-node src/monitor.ts` manualmente.');
    }
    readline.close();
  });
}

// Executar
if (require.main === module) {
  main();
}