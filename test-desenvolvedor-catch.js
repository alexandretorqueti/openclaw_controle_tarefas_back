// Teste para verificar erro no catch

console.log('=== VERIFICANDO ERRO NO CATCH ===\n');

// Primeiro, vou ver o código real do catch
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/steps/DeveloperTurnStep.js');
const content = fs.readFileSync(filePath, 'utf8');

// Encontrar o bloco catch
const catchMatch = content.match(/} catch \(stepError\) \{[\s\S]*?\n\s*\}/);
if (catchMatch) {
  console.log('🔍 CATCH BLOCK ENCONTRADO:');
  console.log(catchMatch[0]);
  console.log('\n📏 Tamanho do catch:', catchMatch[0].length, 'caracteres');
} else {
  console.log('❌ Catch block não encontrado');
}

// Verificar se há return no catch
if (catchMatch && catchMatch[0].includes('return')) {
  console.log('\n✅ Catch tem return');
} else {
  console.log('\n❌ Catch NÃO tem return - método retorna undefined em caso de erro');
}

// Verificar linhas próximas ao catch
const lines = content.split('\n');
const catchLineIndex = lines.findIndex(line => line.includes('} catch (stepError)'));
if (catchLineIndex !== -1) {
  console.log('\n🔍 LINHAS AO REDOR DO CATCH:');
  for (let i = Math.max(0, catchLineIndex - 5); i < Math.min(lines.length, catchLineIndex + 10); i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}