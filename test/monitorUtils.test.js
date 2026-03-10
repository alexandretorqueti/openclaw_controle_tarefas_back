// test/monitorUtils.test.js
// Testes unitários para utilitários do monitor

const fs = require('fs').promises;
const path = require('path');

// Importa funções utilitárias que serão extraídas para src/utils
const { segundosToMinutos_Segundos, fileExists } = require('../src/utils/monitorUtils');

describe('Monitor Utils', () => {
  describe('segundosToMinutos_Segundos', () => {
    test('deve converter 0 segundos corretamente', () => {
      const result = segundosToMinutos_Segundos(0);
      expect(result).toBe('0m 0.00s');
    });

    test('deve converter segundos menores que um minuto', () => {
      const result = segundosToMinutos_Segundos(45.5);
      expect(result).toBe('0m 45.50s');
    });

    test('deve converter exatamente um minuto', () => {
      const result = segundosToMinutos_Segundos(60);
      expect(result).toBe('1m 0.00s');
    });

    test('deve converter minutos e segundos', () => {
      const result = segundosToMinutos_Segundos(125);
      expect(result).toBe('2m 5.00s');
    });

    test('deve lidar com valores decimais', () => {
      const result = segundosToMinutos_Segundos(90.75);
      expect(result).toBe('1m 30.75s');
    });
  });

  describe('fileExists', () => {
    const testFilePath = path.join(__dirname, 'test-file-exists.tmp');

    afterEach(async () => {
      try {
        await fs.unlink(testFilePath);
      } catch (e) {
        // Ignora se o arquivo não existe
      }
    });

    test('deve retornar true para arquivo existente', async () => {
      await fs.writeFile(testFilePath, 'test content');
      const result = await fileExists(testFilePath);
      expect(result).toBe(true);
    });

    test('deve retornar false para arquivo inexistente', async () => {
      const result = await fileExists('/caminho/inexistente/arquivo.txt');
      expect(result).toBe(false);
    });
  });
});
