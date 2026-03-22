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

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Fix broken fs promises: import fs from 'fs';.promises; -> import fs from 'fs/promises';
    content = content.replace(/import\s+fs\s+from\s+['"]fs['"];\.promises;/g, "import fs from 'fs/promises';");
    
    // 2. Fix broken new exports: export default new; AuthController(); -> export default new AuthController();
    content = content.replace(/export\s+default\s+new;\s+(\w+)\(\);/g, "export default new $1();");

    // 3. Fix other semicolon issues in exports
    content = content.replace(/export\s+default\s+new;\s+(\w+);/g, "export default new $1();");

    // 4. Fix specific import breakage like: import { log } from '../aux/logger';
    // If it was const { log } = require('../aux/logger'), it might have been missed or broken.

    // 5. Fix double module scope force
    if ((content.match(/export\s+{};/g) || []).length > 1) {
        content = content.replace(/export\s+{};/g, '');
        content += '\n\nexport {};';
    }

    // 6. Fix class properties being outside
    // ... too complex for regex maybe

    // 7. Fix return type Promise<any> syntax error if any
    content = content.replace(/Promise<any>\s*=>/g, "Promise<any> =>");

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    return false;
}

const files = findTsFiles(SRC_DIR);
files.forEach(f => {
    if (fixFile(f)) {
        console.log(`Fixed: ${path.relative(SRC_DIR, f)}`);
    }
});
