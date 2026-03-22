


// src/services/contractVerificationService.js
// Servico para verificacao de contratos de tarefas

const fs = require('fs').promises;
const path = require('path');
const { resolveProjectPath, isPathInside } = require('../utils/pathUtils');
const { isInspectionCommand, commandTargetsOnlySpecialFiles, isMeaningfulCommand } = require('../utils/commandUtils');
const TaskAnalysisService = require('./taskAnalysisService');
const WorkspaceSnapshotService = require('./workspaceSnapshotService'); // <-- Nova importação
const validationRules = require('./contractValidationRules');

class ContractVerificationService {
/**
   * Verifica se o contrato da tarefa foi cumprido
   * @param {string} doneFile - Caminho do arquivo .done
   * @param {string} relatorioFile - Caminho do arquivo de relatorio
   * @param {string} terminalLogFile - Caminho do log de terminal
   * @param {Object} options - Opcoes de verificacao
   * @returns {Promise<Object>}
   */
  static async verifyContract(doneFile, relatorioFile, terminalLogFile, options = {}) {
    try {
      // === 1. BUSCA TOLERANTE DO .DONE ===
      let doneExists = await fs.access(doneFile).then(() => true).catch(() => false);
      let actualDonePath = doneFile;

      if (!doneExists) {
        const findDynamicDone = async (dir) => {
            if (!dir) return null;
            try {
                const files = await fs.readdir(dir);
                const found = files.find(f => f.endsWith('.done'));
                return found ? path.join(dir, found) : null;
            } catch (e) { return null; }
        };

        const tasksDirDone = await findDynamicDone(path.dirname(doneFile));
        const projectDirDone = await findDynamicDone(options.project?.pastaBase);

        const rogueDoneFile = tasksDirDone || projectDirDone;
        
        if (rogueDoneFile) {
            doneExists = true;
            actualDonePath = rogueDoneFile;
            console.log(`\n🕵️ [SISTEMA] Arquivo .done com nome customizado detectado e aceito: ${path.basename(rogueDoneFile)}\n`);
        }
      }

      // === 2. BUSCA TOLERANTE DO RELATÓRIO ===
      let relatorioExists = await fs.access(relatorioFile).then(() => true).catch(() => false);
      let actualRelatorioPath = relatorioFile;

      if (!relatorioExists) {
        const findDynamicRelatorio = async (dir) => {
            if (!dir) return null;
            try {
                const files = await fs.readdir(dir);
                const found = files.find(f => f.toLowerCase().startsWith('relatorio') && (f.endsWith('.txt') || f.endsWith('.md')));
                return found ? path.join(dir, found) : null;
            } catch (e) { return null; }
        };

        const tasksDirRelatorio = await findDynamicRelatorio(path.dirname(relatorioFile));
        const projectDirRelatorio = await findDynamicRelatorio(options.project?.pastaBase);
        
        const rogueRelatorioFile = tasksDirRelatorio || projectDirRelatorio;
        
        if (rogueRelatorioFile) {
            relatorioExists = true;
            actualRelatorioPath = rogueRelatorioFile;
            console.log(`\n🕵️ [SISTEMA] Arquivo de relatório customizado detectado e aceito: ${path.basename(rogueRelatorioFile)}\n`);
        }
      }

      // === 3. ATUALIZA CAMINHOS REAIS PARA LIMPEZA ===
      if (options && options.files) {
          options.files.doneFile = actualDonePath;
          options.files.relatorioFile = actualRelatorioPath;
      }

      // === 4. VALIDAÇÃO DE CONTEÚDO ===
      let executionNotes = '';
      let relatorioValido = false;
      let relatorioVazio = false; // Flag de sobrevivência e educação

      if (relatorioExists) {
        try {
          const relatorioContent = await fs.readFile(actualRelatorioPath, 'utf8');
          if (relatorioContent.trim().length > 20) {
            executionNotes = relatorioContent.trim();
            relatorioValido = true;
          } else {
            relatorioVazio = true;
          }
        } catch (_) {}
      }

      const politeEmptyReportMessage = "[VALIDAÇÃO] Olá! Notei que você criou o arquivo de relatório com sucesso, muito obrigado! Porém, ele parece estar vazio (ou muito curto). Por gentileza, use a ferramenta 'write' ou 'edit' para preencher o conteúdo dele com o seu resumo antes de concluirmos a tarefa.";

      // Verificacao simples quando nao ha opcoes
      if (!options || Object.keys(options).length === 0) {
        if (doneExists || relatorioValido) {
          return {
            contractFulfilled: true,
            executionNotes: executionNotes || 'Concluido via Orquestrador'
          };
        }

        return {
          contractFulfilled: false,
          executionNotes: 'Contrato nao cumprido.'
        };
      }

      const {
        taskType = 'automation',
        task = {},
        evidence = {},
        project = null,
        analysisPlan = null,
        initialSnapshot = null
      } = options;

      const resolvedAnalysisPlan = analysisPlan || TaskAnalysisService.analyzeTaskScope(task, project, options.files);

      // === A NOVA FONTE DA VERDADE (FILE SYSTEM) ===
      let realModifiedFiles = [];
      
      if (initialSnapshot && project?.pastaBase) {
        const allChangedInDisk = await WorkspaceSnapshotService.getModifiedFiles(initialSnapshot, project.pastaBase);

        realModifiedFiles = allChangedInDisk.filter(filePath => {
          const resolvedPath = path.resolve(filePath);
          const fileName = path.basename(resolvedPath);

          if (
              resolvedPath === path.resolve(actualDonePath) ||
              resolvedPath === path.resolve(actualRelatorioPath) ||
              resolvedPath === path.resolve(terminalLogFile)
          ) {
              return false;
          }

          if (/^(prompt|relatorio|terminal|done|plano-arquiteto|terminal-arquiteto)-.*\.(txt|log|done)$/i.test(fileName)) {
              return false;
          }

          return true;
        });
        
      } else {
         const modifiedFiles = Array.from(evidence.modifiedFiles || []);
         const filesWritten = Array.from(evidence.filesWritten || []);
         realModifiedFiles = [...new Set([...modifiedFiles, ...filesWritten])].filter(
            (file) => file !== actualRelatorioPath && file !== actualDonePath && file !== terminalLogFile
         );
      }

      const filesRead = Array.from(evidence.filesRead || []);
      const touchedFiles = Array.from(evidence.touchedFiles || []);
      const commandsExecuted = Array.from(evidence.commandsExecuted || []);

      const specialArtifacts = [actualRelatorioPath, actualDonePath, terminalLogFile]
        .filter(Boolean)
        .map((file) => path.resolve(file));

      const isOnlySpecialCommand = (cmd) =>
        commandTargetsOnlySpecialFiles(
          cmd,
          specialArtifacts,
          project?.pastaBase || process.cwd()
        );

      const realTouchedFiles = Array.from(
        new Set([...filesRead, ...touchedFiles, ...realModifiedFiles])
      ).filter((file) => file && file !== actualRelatorioPath && file !== actualDonePath && file !== terminalLogFile);

      const inspectionCommands = commandsExecuted.filter((cmd) =>
        isInspectionCommand(cmd || '') && !isOnlySpecialCommand(cmd)
      );

      const meaningfulCommands = commandsExecuted.filter((cmd) => {
        if (!cmd || typeof cmd !== 'string') return false;
        return isMeaningfulCommand(cmd, specialArtifacts, project?.pastaBase || process.cwd());
      });

      const fullFrontendPath = resolveProjectPath(project?.pastaBase, project?.frontendPath);
      const fullBackendPath = resolveProjectPath(project?.pastaBase, project?.backendPath);

      const isFrontendFile = (file) => {
          if (!file) return false;
          const normalized = file.replace(/\\/g, '/');
          if (fullFrontendPath && isPathInside(normalized, fullFrontendPath)) return true;
          if (project?.frontendPath && normalized.includes(project.frontendPath)) return true;
          return false;
      };

      const isBackendFile = (file) => {
          if (!file) return false;
          const normalized = file.replace(/\\/g, '/');
          if (fullBackendPath && isPathInside(normalized, fullBackendPath)) return true;
          if (project?.backendPath && normalized.includes(project.backendPath)) return true;
          return false;
      };

      const modifiedInFrontend = realModifiedFiles.filter(isFrontendFile);
      const modifiedInBackend = realModifiedFiles.filter(isBackendFile);

      const touchedInFrontend = realTouchedFiles.filter(isFrontendFile);
      const touchedInBackend = realTouchedFiles.filter(isBackendFile);

      const reportRequired =
        TaskAnalysisService.requiresReport(task) ||
        taskType === 'analysis' ||
        taskType === 'development';

      // ==============================================================
      // O NOVO MOTOR DE REGRAS (RULE ENGINE)
      // ==============================================================
      
      // 1. Pré-calculamos as condições complexas de arquitetura para o contexto
      const requiresFrontendMod = resolvedAnalysisPlan.requiredModifiedLayers?.includes('frontend') && fullFrontendPath;
      const requiresBackendMod = resolvedAnalysisPlan.requiredModifiedLayers?.includes('backend') && fullBackendPath;
      const expectsFrontendTouch = resolvedAnalysisPlan.expectedLayers?.includes('frontend') && !resolvedAnalysisPlan.requiredModifiedLayers?.includes('frontend') && fullFrontendPath;
      const expectsBackendTouch = resolvedAnalysisPlan.expectedLayers?.includes('backend') && !resolvedAnalysisPlan.requiredModifiedLayers?.includes('backend') && fullBackendPath;
      
      const haEvidenciaInspecao = realTouchedFiles.length > 0 || inspectionCommands.length > 0;
      const usefulExecution = realModifiedFiles.length > 0 || realTouchedFiles.length > 0 || meaningfulCommands.length > 0;

      // 2. Empacotamos todo o estado atual em um "Contexto"
      const context = {
        relatorioValido,
        relatorioVazio,
        doneExists,
        haEvidenciaInspecao,
        realModifiedFiles,
        requiresFrontendMod,
        requiresBackendMod,
        expectsFrontendTouch,
        expectsBackendTouch,
        modifiedInFrontend,
        modifiedInBackend,
        touchedInFrontend,
        touchedInBackend,
        reportRequired,
        usefulExecution,
        project,
        fullFrontendPath,
        fullBackendPath
      };

      // 3. Selecionamos a lista de regras baseada no tipo da tarefa
      const rulesToRun = validationRules[taskType];

      // 4. Iteramos sobre as regras. A primeira que falhar (hasError = true), dispara o erro!
      if (rulesToRun) {
        for (const rule of rulesToRun) {
          if (rule.hasError(context)) {
            return rule.getError(context); // Interrompe imediatamente devolvendo a bronca
          }
        }
      }

      // Se passou ileso por todas as regras daquele array, SUCESSO! 🎉
      return {
        contractFulfilled: true,
        executionNotes: executionNotes || `Tarefa de ${taskType} concluida.`
      };

    } catch (e) {
      return {
        contractFulfilled: false,
        executionNotes: e.message
      };
    }
  }
}

module.exports = ContractVerificationService;