#!/usr/bin/env node
/**
 * SCRIPT SEGURO PARA RESTAURAÇÃO DE DADOS ESSENCIAIS
 *
 * Este script apenas ADICIONA dados faltantes, NUNCA remove dados existentes.
 * É seguro executar múltiplas vezes (usando upsert para evitar duplicação).
 *
 * CONFIGURAÇÕES NO .env:
 * - FRONTEND_PATH, FRONTEND_PORT, BACKEND_PATH, BACKEND_PORT, REPOSITORY_URL
 * - MAIN_PROJECT_NAME, MAIN_PROJECT_DESCRIPTION, MAIN_PROJECT_RULES
 */
declare const PrismaClient: any;
declare const prisma: any;
declare const CONFIG: {
    FRONTEND_PATH: string;
    FRONTEND_PORT: number;
    BACKEND_PATH: string;
    BACKEND_PORT: number;
    REPOSITORY_URL: string;
    MAIN_PROJECT_NAME: string;
    MAIN_PROJECT_DESCRIPTION: string;
    MAIN_PROJECT_RULES: string;
};
declare function validateConfig(): void;
declare function getUserIds(): Promise<{
    ALEXANDRE_ID: any;
    JARBAS_ID: any;
}>;
declare function restoreStatuses(): Promise<void>;
declare function restorePriorities(): Promise<void>;
declare function restoreMainProject(userIds: any): Promise<void>;
declare function finalVerification(): Promise<void>;
declare function restoreEssentialData(): Promise<void>;
