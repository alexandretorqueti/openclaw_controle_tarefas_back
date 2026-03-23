import fs from 'fs');
const path=require('path');

function processFile(filePath){
  let code=fs.readFileSync(filePath,'utf-8';
  const requireRegex=/\s*const\s+([A-Za-z0-9_]+)\s*=\s*require\(['\"]([^\"]+)['\"]\);/g;
  const requireObjRegex=/\s*const\s+\{\s*([^}]+)\}\s*=\s*require\(['\"]([^\"]+)['\"]\);/g;
  let m;
  while((m=requireRegex.exec(code))!==null){
    const varName=m[1]; const modName=m[2];
    code=code.replace(m[0],`import ${varName} from '${modName}';`);
  }
  while((m=requireObjRegex.exec(code))!==null){
    const vars=m[1].split(',').map(v=>v.trim()); const modName=m[2];
    const specs = vars.map(v=>{const [src, alias] = v.split(/\s*=\s*/); if(src===alias||!alias){return `import { ${src} }`; } return `import { ${src} as ${alias} }`;});
    code=code.replace(m[0],`${specs.join(', ')} from '${modName}';`);
  }
  fs.writeFileSync(filePath,code,'utf-8');
}

function walk(dir){
  const files=fs.readdirSync(dir);
  files.forEach(f=>{
    const fp=path.join(dir,f);
    const stat=fs.statSync(fp);
    if(stat.isDirectory()) walk(fp); else if(['.js','.ts'].includes(path.extname(f))) processFile(fp);
  });
}

walk(process.argv[2]||'.');
