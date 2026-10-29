const fs=require('fs'),path=require('path'),crypto=require('crypto');
const source=path.resolve('C:/starstream');
const root=path.join(source,'deliverables/starstream-update-2026-10-28');
fs.mkdirSync(root,{recursive:true});
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const origins=[];
function copy(rel,section) {
  const dest=path.join(root,section,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join(source,rel),dest);origins.push({source:rel,packagePath:section+'/'+rel,sha256:hash(dest)});
}
function walk(rel,section,allowed){for(const e of fs.readdirSync(path.join(source,rel),{withFileTypes:true})){const p=rel+'/'+e.name;if(e.isDirectory())walk(p,section,allowed);else if(allowed(p))copy(p,section);}}
walk('admin-ui/src','payload',p=>/\.(tsx?|css)$/.test(p));
for(const p of ['index.html','package.json','package-lock.json','tsconfig.json'])copy('admin-ui/'+p,'payload');
for(const p of ['star-stream-logo.svg','cebu-cable-internet.png'])copy('admin-ui/public/'+p,'payload');
walk('api-mgmt/src','backend-reference',p=>p.endsWith('.php')&&!p.endsWith('/UsersController.php'));
for(const p of ['composer.json','composer.lock','public/index.php'])copy('api-mgmt/'+p,'backend-reference');
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/source-provenance.json'),JSON.stringify({baselineAvailable:false,files:origins},null,2)+'\n');
console.log(JSON.stringify({root,payload:origins.filter(x=>x.packagePath.startsWith('payload/')).length,backendReference:origins.filter(x=>x.packagePath.startsWith('backend-reference/')).length}));
