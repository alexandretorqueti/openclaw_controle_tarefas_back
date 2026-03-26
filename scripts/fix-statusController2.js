const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, '../dist/controllers/statusController.js');
let content = fs.readFileSync(controllerPath, 'utf8');

console.log('ANTES:');
console.log(content.match(/getAllStatuses = ErrorMiddleware\.catchAsync[\s\S]*?\n    \}/)?.[0]);

// Substituir apenas o bloco do getAllStatuses
content = content.replace(
    /getAllStatuses = ErrorMiddleware\.catchAsync\(async \(req, res, next\) => \{[\s\S]*?res\.json\(\{\s*count: statuses\.length,[\s\S]*?correlationId: req\.correlationId\s*\}\);[\s\S]*?\}\);/,
    `getAllStatuses = ErrorMiddleware.catchAsync(async (req, res, next) => {
        const statuses = await prisma.status.findMany({
            orderBy: {
                order: 'asc'
            }
        });
        
        console.log(\`🔍 [StatusController] getAllStatuses retornando \${statuses.length} status(es)\`);
        res.json(statuses);
    });`
);

console.log('\nDEPOIS:');
console.log(content.match(/getAllStatuses = ErrorMiddleware\.catchAsync[\s\S]*?\n    \}/)?.[0]);

fs.writeFileSync(controllerPath, content, 'utf8');
console.log('\n✅ arquivo atualizado!');
