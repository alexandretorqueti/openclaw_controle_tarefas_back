// test/mocks/timeUtils.mock.js

/**
 * Mock do TimeUtils para testes
 */
function createTimeUtilsMock(customizations = {}) {
  const mock = {
    segundosToMinutos_Segundos: jest.fn(),
    msToReadable: jest.fn(),
    getLogTimestamp: jest.fn(),
    isPastDate: jest.fn(),
    addMinutes: jest.fn(),
    isProcessAlive: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.segundosToMinutos_Segundos.mockImplementation((segundos) => {
    const minutos = Math.floor(segundos / 60);
    const segundosRestantes = segundos % 60;
    return `${minutos}m ${segundosRestantes.toFixed(2)}s`;
  });
  
  mock.msToReadable.mockImplementation((ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const segundos = ms / 1000;
    const minutos = Math.floor(segundos / 60);
    const segundosRestantes = segundos % 60;
    return `${minutos}m ${segundosRestantes.toFixed(2)}s`;
  });
  
  mock.getLogTimestamp.mockReturnValue('2026-03-20 13:30:00');
  mock.isPastDate.mockReturnValue(false);
  mock.addMinutes.mockImplementation((date, minutes) => {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  });
  mock.isProcessAlive.mockResolvedValue(true);
  
  return mock;
}

module.exports = { createTimeUtilsMock };