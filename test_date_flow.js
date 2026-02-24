// Simulando o fluxo completo

// 1. Frontend envia (já convertido para snake_case pelo api.ts)
const frontendPayload = {
  "deadline": "2026-02-23T18:16",
  "created_at": "2026-02-23T18:16:30.839Z",
  "updated_at": "2026-02-23T21:00:46.235Z"
};

console.log("1. Frontend envia:", JSON.stringify(frontendPayload, null, 2));

// 2. Backend recebe e converte snake_case para camelCase
function snakeToCamel(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        newObj[camelKey] = snakeToCamel(obj[key]);
      }
    }
    return newObj;
  }
  
  return obj;
}

const backendData = snakeToCamel(frontendPayload);
console.log("\n2. Backend após snakeToCamel:", JSON.stringify(backendData, null, 2));

// 3. Testando a regex diretamente
const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
console.log("\n3. Teste direto da regex:");
console.log("2026-02-23T18:16:", isoRegex.test("2026-02-23T18:16") ? "✓" : "✗");
console.log("2026-02-23T18:16:00:", isoRegex.test("2026-02-23T18:16:00") ? "✓" : "✗");
console.log("2026-02-23T18:16:00.000Z:", isoRegex.test("2026-02-23T18:16:00.000Z") ? "✓" : "✗");

// 4. Testando new Date()
console.log("\n4. Teste new Date():");
const date1 = new Date("2026-02-23T18:16");
console.log("new Date('2026-02-23T18:16'):", date1);
console.log("É válido?", !isNaN(date1.getTime()));
