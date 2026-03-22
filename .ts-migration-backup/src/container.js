// src/container.js
/**
 * Container de dependências simples (Service Locator).
 *
 * Uso típico:
 *   const container = require('./container');
 *   container.register('openClawService', OpenClawService);
 *   const svc = container.resolve('openClawService');
 */
class Container {
  constructor() {
    this.registry = new Map();
  }

  /** Registra uma dependência pelo nome */
  register(name, value) {
    this.registry.set(name, value);
  }

  /** Resolve (retorna) a dependência registrada */
  resolve(name) {
    if (!this.registry.has(name)) {
      throw new Error(`Dependência não registrada no container: ${name}`);
    }
    return this.registry.get(name);
  }

  /** Limpa todas as dependências (útil nos testes) */
  clear() {
    this.registry.clear();
  }
}

// Exporta um singleton para ser usado em todo o código
module.exports = new Container();