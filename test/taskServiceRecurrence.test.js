// test/taskServiceRecurrence.test.js
// Testes para logica de recorrencia do TaskService

describe('TaskService - Recurrence Logic', () => {
  // Mock do Prisma
  jest.mock('../src/services/prismaService', () => ({
    task: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    status: { findUnique: jest.fn(), findFirst: jest.fn() },
    priority: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() }
  }));

  const TaskService = require('../src/services/taskService');

  describe('calculateNextDailyExecution', () => {
    test('deve calcular proxima execucao diaria', () => {
      const lastExecuted = new Date('2024-01-15T10:00:00');
      const times = ['09:00', '15:00', '21:00'];
      
      const result = TaskService.calculateNextDailyExecution(lastExecuted, times);
      
      expect(result).toBeInstanceOf(Date);
    });

    test('deve usar padrao para array vazio de horarios', () => {
      const lastExecuted = new Date('2024-01-15T10:00:00');
      
      const result = TaskService.calculateNextDailyExecution(lastExecuted, []);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(lastExecuted.getDate() + 1);
    });
  });

  describe('calculateNextWeeklyExecution', () => {
    test('deve calcular proxima execucao semanal', () => {
      const lastExecuted = new Date('2024-01-15T10:00:00'); // Segunda
      const days = [1, 3, 5]; // Segunda, Quarta, Sexta
      const times = ['09:00'];
      
      const result = TaskService.calculateNextWeeklyExecution(lastExecuted, days, times);
      
      expect(result).toBeInstanceOf(Date);
    });

    test('deve ir para proxima semana se nenhum dia restante', () => {
      const lastExecuted = new Date('2024-01-19T10:00:00'); // Sexta
      const days = [1]; // Apenas Segunda
      
      const result = TaskService.calculateNextWeeklyExecution(lastExecuted, days, ['09:00']);
      
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('calculateNextMonthlyExecution', () => {
    test('deve calcular proxima execucao mensal', () => {
      const lastExecuted = new Date('2024-01-15T10:00:00');
      const times = ['09:00'];
      
      const result = TaskService.calculateNextMonthlyExecution(lastExecuted, times);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getMonth()).toBe(lastExecuted.getMonth() + 1);
    });
  });

  describe('calculateNextExecution', () => {
    test('deve retornar null para recurrenceType invalido', () => {
      const taskData = { recurrenceType: null };
      
      const result = TaskService.calculateNextExecution(taskData);
      
      expect(result).toBeNull();
    });

    test('deve chamar metodo correto para daily', () => {
      const taskData = {
        recurrenceType: 'daily',
        recurrenceTimes: ['09:00'],
        lastExecutedAt: new Date()
      };
      
      const result = TaskService.calculateNextExecution(taskData);
      
      expect(result).toBeInstanceOf(Date);
    });

    test('deve chamar metodo correto para weekly', () => {
      const taskData = {
        recurrenceType: 'weekly',
        recurrenceDays: [1, 3, 5],
        recurrenceTimes: ['09:00'],
        lastExecutedAt: new Date()
      };
      
      const result = TaskService.calculateNextExecution(taskData);
      
      expect(result).toBeInstanceOf(Date);
    });

    test('deve chamar metodo correto para monthly', () => {
      const taskData = {
        recurrenceType: 'monthly',
        recurrenceTimes: ['09:00'],
        lastExecutedAt: new Date()
      };
      
      const result = TaskService.calculateNextExecution(taskData);
      
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('calculateDateTimeForDay', () => {
    test('deve calcular data e hora para um dia especifico', () => {
      const baseDate = new Date('2024-01-15T10:00:00'); // Segunda
      const dayOfWeek = 3; // Quarta
      const times = ['14:30'];
      
      const result = TaskService.calculateDateTimeForDay(dayOfWeek, times, baseDate);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });
  });
});
