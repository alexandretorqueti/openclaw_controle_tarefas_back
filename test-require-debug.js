// Debug de requires

console.log('=== DEBUG REQUIRES ===\n');

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  try {
    console.log(`[REQUIRE] ${id}`);
    return originalRequire.apply(this, arguments);
  } catch (err) {
    console.error(`[REQUIRE ERROR] ${id}: ${err.message}`);
    throw err;
  }
};

// Agora carrega o DeveloperTurnStep
try {
  const DeveloperTurnStep = require('./src/steps/DeveloperTurnStep');
  console.log('\n✅ DeveloperTurnStep carregado com sucesso');
} catch (err) {
  console.error('\n❌ Erro ao carregar:', err.message);
}