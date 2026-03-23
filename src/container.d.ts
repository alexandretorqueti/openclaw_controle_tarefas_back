/**
 * Container de dependências simples (Service Locator).
 *
 * Uso típico:
 *   const container = require('./container');
 *   container.register('openClawService', OpenClawService);
 *   const svc = container.resolve('openClawService');
 */
declare class Container {
    constructor();
    /** Registra uma dependência pelo nome */
    register(name: any, value: any): void;
    /** Resolve (retorna) a dependência registrada */
    resolve(name: any): any;
    /** Limpa todas as dependências (útil nos testes) */
    clear(): void;
}
