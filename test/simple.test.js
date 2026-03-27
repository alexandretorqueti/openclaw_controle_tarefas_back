// Teste simples para verificar se Jest funciona

describe('Teste simples do Jest', () => {
  test('deve somar 1 + 1 corretamente', () => {
    expect(1 + 1).toBe(2);
  });

  test('deve verificar se array está vazio', () => {
    const arr = [];
    expect(arr).toHaveLength(0);
  });
});