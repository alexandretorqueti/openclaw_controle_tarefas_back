// src/utils/monitorUtils.js
// Re-exporta utilitarios do sistema de monitoramento para compatibilidade
const { fileExists } = require('./fileUtils');
const { segundosToMinutos_Segundos, isProcessAlive } = require('./timeUtils');
module.exports = {
    fileExists,
    segundosToMinutos_Segundos,
    isProcessAlive
};
