// src/utils/index.js
// Exporta todos os utilitarios

const fileUtils = require('./fileUtils');
const pathUtils = require('./pathUtils');
const timeUtils = require('./timeUtils');
const commandUtils = require('./commandUtils');
const jsonUtils = require('./jsonUtils');
const formatUtils = require('./formatUtils');
const monitorUtils = require('./monitorUtils');

module.exports = {
  ...fileUtils,
  ...pathUtils,
  ...timeUtils,
  ...commandUtils,
  ...jsonUtils,
  ...formatUtils,
  ...monitorUtils
};
