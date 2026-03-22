// Migrado para TypeScript - Fase: Utils
// Arquivo: index.js

// src/utils/index.js
// Exporta todos os utilitarios

import fileUtils from "./fileUtils";
import pathUtils from "./pathUtils";
import timeUtils from "./timeUtils";
import commandUtils from "./commandUtils";
import jsonUtils from "./jsonUtils";
import formatUtils from "./formatUtils";
import monitorUtils from "./monitorUtils";

// Re-exportar todos os utilitários
// TypeScript não suporta spread em exports, então exportamos individualmente
export * from "./fileUtils";
export * from "./pathUtils";
export * from "./timeUtils";
export * from "./commandUtils";
export * from "./jsonUtils";
export * from "./formatUtils";
export * from "./monitorUtils";

// Exportar defaults também
export { default as fileUtils } from "./fileUtils";
export { default as pathUtils } from "./pathUtils";
export { default as timeUtils } from "./timeUtils";
export { default as commandUtils } from "./commandUtils";
export { default as jsonUtils } from "./jsonUtils";
export { default as formatUtils } from "./formatUtils";
export { default as monitorUtils } from "./monitorUtils";
