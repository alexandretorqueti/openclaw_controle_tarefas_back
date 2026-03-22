#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');

function findTsFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(findTsFiles(file));
        } else if (file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

function masterFix(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // 1. Corrigir redeclaração de variáveis globais injetadas
    const globalVars = ['prisma', 'container', 'ErrorMiddleware', 'UserResolver', 'getAbsoluteAvatarUrl', 'snakeToCamel', 'taskService', 'agentService'];
    globalVars.forEach(v => {
        const regex = new RegExp(`const\\s+${v}\\s+=\\s+require`, 'g');
        content = content.replace(regex, `// @ts-ignore\nconst ${v} = require`);
    });

    // 2. Converter require para import se não estiver no topo ou se estiver sozinho
    content = content.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (match, name, modPath) => {
        if (modPath.startsWith('.')) {
            return `import ${name} from '${modPath}';`;
        }
        return `import * as ${name} from '${modPath}';`;
    });

    // 3. Corrigir destructuring require
    content = content.replace(/const\s+{([^}]+)}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, "import { $1 } from '$2';");

    // 4. Converter module.exports para export default
    content = content.replace(/module\.exports\s*=\s*(\w+);?/g, "export default $1;");
    
    // 5. Corrigir propriedades dinâmicas em classes/objetos com any cast
    content = content.replace(/this\.(\w+)\s*=/g, (match, prop) => {
        if (content.includes(`class`) || content.includes(`constructor`)) {
            return `(this as any).${prop} =`;
        }
        return match;
    });

    // 6. Corrigir erros de Error properties
    content = content.replace(/error\.statusCode\s*=/g, "(error as any).statusCode =");
    content = content.replace(/error\.errors\s*=/g, "(error as any).errors =");
    content = content.replace(/error\.code\s*=/g, "(error as any).code =");

    // 7. Corrigir o problema do '____filename' que apareceu em scripts anteriores
    content = content.replace(/____filename/g, "__filename");

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    return false;
}

const files = findTsFiles(SRC_DIR);
console.log(`Fixing ${files.length} files...`);
let fixed = 0;
files.forEach(f => {
    if (masterFix(f)) fixed++;
});
console.log(`Done. Fixed ${fixed} files.`);
