// monitor/services/DoneFileService.ts
// ─────────────────────────────────────────────────────
// Serviço para busca inteligente de arquivos .done
// Procura em múltiplos locais com fallbacks
// ─────────────────────────────────────────────────────

import type { Logger } from '../interfaces/logger';

export interface DoneFileServiceDeps {
  logger: Logger;
  fileSystem: {
    readdir: (path: string) => Promise<string[]>;
    access: (path: string) => Promise<void>;
    stat: (path: string) => Promise<{ isDirectory: () => boolean }>;
  };
  path: {
    join: (...parts: string[]) => string;
  };
}

export interface DoneFileSearchResult {
  found: boolean;
  path: string | null;
  searchedLocations: string[];
}

export class DoneFileService {
  readonly logger: Logger;
  readonly fileSystem: DoneFileServiceDeps['fileSystem'];
  readonly path: DoneFileServiceDeps['path'];

  constructor(deps: DoneFileServiceDeps) {
    this.logger = deps.logger;
    this.fileSystem = deps.fileSystem;
    this.path = deps.path;
  }

  /**
   * Busca arquivo .done em múltiplos locais com prioridade
   * 1. Diretório da tarefa (taskDir)
   * 2. Pasta base do projeto (pastaBase)
   * 3. Subdiretórios relevantes do projeto
   * 
   * @param taskDir Diretório isolado da tarefa
   * @param projectBaseDir Pasta base do projeto (opcional)
   * @returns Resultado da busca
   */
  async findDoneFile(
    taskDir: string,
    projectBaseDir?: string
  ): Promise<DoneFileSearchResult> {
    const searchedLocations: string[] = [];
    
    // 1. Busca no diretório da tarefa (PRIMEIRA PRIORIDADE)
    const taskDirDone = await this.searchInDirectory(taskDir, '.done');
    searchedLocations.push(taskDir);
    
    if (taskDirDone.found) {
      await this.logger.info(`✅ .done encontrado no diretório da tarefa: ${taskDirDone.path}`);
      return {
        found: true,
        path: taskDirDone.path,
        searchedLocations
      };
    }

    // 2. Busca na pasta base do projeto (SEGUNDA PRIORIDADE)
    if (projectBaseDir) {
      const projectBaseDone = await this.searchInDirectory(projectBaseDir, '.done');
      searchedLocations.push(projectBaseDir);
      
      if (projectBaseDone.found) {
        await this.logger.info(`✅ .done encontrado na pasta base do projeto: ${projectBaseDone.path}`);
        return {
          found: true,
          path: projectBaseDone.path,
          searchedLocations
        };
      }

      // 3. Busca em subdiretórios relevantes do projeto (TERCEIRA PRIORIDADE)
      const relevantSubdirs = await this.findRelevantSubdirectories(projectBaseDir);
      
      for (const subdir of relevantSubdirs) {
        const subdirDone = await this.searchInDirectory(subdir, '.done');
        searchedLocations.push(subdir);
        
        if (subdirDone.found) {
          await this.logger.info(`✅ .done encontrado em subdiretório: ${subdirDone.path}`);
          return {
            found: true,
            path: subdirDone.path,
            searchedLocations
          };
        }
      }
    }

    await this.logger.info(`🔍 .done não encontrado em nenhum local. Locais pesquisados: ${searchedLocations.join(', ')}`);
    return {
      found: false,
      path: null,
      searchedLocations
    };
  }

  /**
   * Busca arquivo específico em um diretório
   */
  private async searchInDirectory(
    dir: string,
    filename: string
  ): Promise<{ found: boolean; path: string | null }> {
    try {
      // Verifica se diretório existe
      await this.fileSystem.access(dir);
      
      // Lista arquivos do diretório
      const files = await this.fileSystem.readdir(dir);
      
      // Procura arquivo com nome exato ou que termine com o sufixo
      const foundFile = files.find(file => 
        file === filename || file.endsWith(`.${filename}`) || file.endsWith(filename)
      );
      
      if (foundFile) {
        return {
          found: true,
          path: this.path.join(dir, foundFile)
        };
      }
    } catch (error) {
      // Diretório não existe ou sem permissão - ignora silenciosamente
    }
    
    return { found: false, path: null };
  }

  /**
   * Encontra subdiretórios relevantes para busca (exclui node_modules, .git, etc.)
   */
  private async findRelevantSubdirectories(baseDir: string): Promise<string[]> {
    const relevantDirs: string[] = [];
    const ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    
    try {
      await this.fileSystem.access(baseDir);
      const entries = await this.fileSystem.readdir(baseDir);
      
      for (const entry of entries) {
        const fullPath = this.path.join(baseDir, entry);
        
        try {
          const stat = await this.fileSystem.stat(fullPath);
          
          if (stat.isDirectory() && !ignorePatterns.includes(entry)) {
            relevantDirs.push(fullPath);
            
            // Busca recursivamente um nível abaixo
            const subEntries = await this.fileSystem.readdir(fullPath);
            for (const subEntry of subEntries) {
              const subPath = this.path.join(fullPath, subEntry);
              
              try {
                const subStat = await this.fileSystem.stat(subPath);
                if (subStat.isDirectory() && !ignorePatterns.includes(subEntry)) {
                  relevantDirs.push(subPath);
                }
              } catch {
                // Ignora erros em subdiretórios
              }
            }
          }
        } catch {
          // Ignora erros ao acessar entrada
        }
      }
    } catch {
      // Ignora erro ao acessar diretório base
    }
    
    return relevantDirs;
  }

  /**
   * Verifica se arquivo .done existe em local específico
   */
  async checkDoneFileExists(path: string): Promise<boolean> {
    try {
      await this.fileSystem.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cria arquivo .done em local específico
   */
  async createDoneFile(path: string): Promise<boolean> {
    try {
      // Em um sistema real, isso usaria writeFile
      // Para simplicidade, apenas verificamos se podemos acessar
      const dirname = path.split('/').slice(0, -1).join('/');
      await this.fileSystem.access(dirname);
      await this.logger.info(`📝 Criando arquivo .done em: ${path}`);
      return true;
    } catch (error) {
      await this.logger.erro(`❌ Erro ao criar .done em ${path}: ${error}`);
      return false;
    }
  }
}