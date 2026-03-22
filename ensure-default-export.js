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

function ensureDefaultExport(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Pattern: export { a, b, c };
    const exportRegex = /export\s+{([^}]+)};/g;
    const match = exportRegex.exec(content);
    
    if (match && !content.includes('export default')) {
        const exportsList = match[1].trim();
        content += `\n\nexport default { ${exportsList} };`;
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    return false;
}

const files = findTsFiles(SRC_DIR);
files.forEach(f => {
    if (ensureDefaultExport(f)) {
        console.log(`Added default export to: ${path.relative(SRC_DIR, f)}`);
    }
});
