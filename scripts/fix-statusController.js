const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, '../dist/controllers/statusController.js');
let content = fs.readFileSync(controllerPath, 'utf8');

const oldContent = `getAllStatuses = ErrorMiddleware.catchAsync(async (req, res, next) => {
        const statuses = await prisma.status.findMany({
            orderBy: {
                order: 'asc'
            }
        });
        
        res.json({
            count: statuses.length,
            statuses,
            correlationId: req.correlationId
        });
    });`;

const newContent = `getAllStatuses = ErrorMiddleware.catchAsync(async (req, res, next) => {
        const statuses = await prisma.status.findMany({
            orderBy: {
                order: 'asc'
            }
        });
        
        console.log(\`🔍 [StatusController] getAllStatuses retornando \${statuses.length} status(es)\`);
        res.json(statuses);
    });`;

if (content.includes(oldContent)) {
    content = content.replace(oldContent, newContent);
    fs.writeFileSync(controllerPath, content, 'utf8');
    console.log('✅ statusController.js atualizado com sucesso!');
} else {
    console.log('❌ Não encontrou o texto exato para substituir');
    console.log('Conteúdo do arquivo:');
    console.log(content);
}
