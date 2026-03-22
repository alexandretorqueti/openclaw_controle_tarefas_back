#!/usr/bin/env node

/**
 * Super Module Converter: JS (CommonJS) -> TS (ESM)
 * Corrects require/module.exports to import/export
 */

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

function convertFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Convert simple require: const x = require('y') -> import x from 'y'
    // We use a safe approach: import x from 'y' if it's a package or local file
    content = content.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (match, varName, modPath) => {
        // If it's a local file, remove .js extension if present
        const cleanPath = modPath.endsWith('.js') ? modPath.slice(0, -3) : modPath;
        return `import ${varName} from '${cleanPath}';`;
    });

    // 2. Convert destructuring require: const { x } = require('y') -> import { x } from 'y'
    content = content.replace(/const\s+{([^}]+)}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (match, imports, modPath) => {
        const cleanPath = modPath.endsWith('.js') ? modPath.slice(0, -3) : modPath;
        return `import {${imports}} from '${cleanPath}';`;
    });

    // 3. Convert module.exports = x -> export default x
    content = content.replace(/module\.exports\s*=\s*(\w+);?/g, 'export default $1;');

    // 4. Convert module.exports = { ... } -> export default { ... }
    // First try to extract named exports if it's a simple object literal
    content = content.replace(/module\.exports\s*=\s*{([^}]+)};?/g, (match, exportsList) => {
        const cleaned = exportsList.trim();
        // If it's just a list of names like { a, b, c }
        if (/^[\w\s,]+$/.test(cleaned)) {
            return `export {${cleaned}};\nexport default {${cleaned}};`;
        }
        return `export default {${cleaned}};`;
    });

    // 5. Convert exports.x = y -> export const x = y
    content = content.replace(/exports\.(\w+)\s*=\s*([^;]+);?/g, 'export const $1 = $2;');

    // 6. Fix class declarations without export
    if (content.includes('class ') && !content.includes('export class ') && !content.includes('export default')) {
        content = content.replace(/class\s+(\w+)/g, 'export class $1');
    }

    // 7. Ensure every file is a module by adding an empty export if none exists
    if (!content.includes('import ') && !content.includes('export ')) {
        content += '\n\nexport {}; // Force module scope';
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    return false;
}

const files = findTsFiles(SRC_DIR);
console.log(`Found ${files.length} TS files.`);
let count = 0;
files.forEach(f => {
    if (convertFile(f)) {
        count++;
        console.log(`Converted: ${path.relative(SRC_DIR, f)}`);
    }
});

console.log(`Done. Converted ${count} files.`);
