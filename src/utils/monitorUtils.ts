// Migrado para TypeScript - Fase: Utils
// Arquivo: monitorUtils.js

// src/utils/monitorUtils.js
// Re-exporta utilitarios do sistema de monitoramento para compatibilidade

import { fileExists } from './fileUtils';
import { segundosToMinutos_Segundos, isProcessAlive } from './timeUtils';

export {
  fileExists,
  segundosToMinutos_Segundos,
  isProcessAlive
};



export default { fileExists,
  segundosToMinutos_Segundos,
  isProcessAlive };