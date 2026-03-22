#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');

function findTsFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !['node_modules', 'dist', 'test'].includes(item)) {
            files.push(...findTsFiles(fullPath));
        } else if (item.endsWith('.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

function fixImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Fix broken assignments from previous scripts
    content = content.replace(/^(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/gm, "import $1 from '$2';");

    // Fix Promise<any> syntax error: ):Promise<any>{ -> ): Promise<any> {
    content = content.replace(/\):Promise<any>{/g, "): Promise<any> {");
    content = content.replace(/\):any{/g, "): Promise<any> {");

    // Fix the "____filename" issue again just in case
    content = content.replace(/____filename/g, "__filename");

    // Fix imports that should be * as
    const needsNamespace = ['fs', 'path', 'axios', 'uuid', 'child_process'];
    needsNamespace.forEach(pkg => {
        const regex = new RegExp(`import\\s+${pkg}\\s+from\\s+['"]${pkg}['"];`, 'g');
        content = content.replace(regex, `import * as ${pkg} from '${pkg}';`);
    });

    // Special case for fs/promises
    content = content.replace(/import\s+\*\s+as\s+fs\s+from\s+['"]fs\/promises['"];/g, "import fs from 'fs/promises';");

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    return false;
}

const files = findTsFiles(SRC_DIR);
files.forEach(f => {
    if (fixImports(f)) {
        console.log(`Fixed imports in: ${path.relative(SRC_DIR, f)}`);
    }
});
