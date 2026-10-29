const fs=require('fs'),path=require('path'),crypto=require('crypto');
const src=path.resolve('C:/starstream'),root=path.join(src,'deliverables/starstream-update-2026-10-28');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function walk(p,rel=''){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>{const r=rel?rel+'/'+e.name:e.name;if(e.isSymbolicLink())throw Error('Unexpected link');return e.isDirectory()?walk(path.join(p,e.name),r):[r];}).sort();}
const origins=JSON.parse(fs.readFileSync(path.join(root,'docs/source-provenance.json'))).files;
for(const f of origins)if(hash(path.join(src,f.source))!==f.sha256||hash(path.join(root,f.packagePath))!==f.sha256)throw Error('Source drift: '+f.source);
const suspect=[];
const rules=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bsk-[A-Za-z0-9]{30,}\b/,/https?:\/\/[^\s/"']+:[^\s/@"']+@/,/\b(?:password|secret|api_key|db_pass)\s*[=:]\s*["'][^"'\s]{8,}["']/i];
for(const f of origins){
  if(/\.(png)$/i.test(f.source))continue;
  const text=fs.readFileSync(path.join(root,f.packagePath),'utf8');
  if(rules.some(r=>r.test(text)))suspect.push(f.packagePath);
  if(f.source.endsWith('.svg')&&(/<script\b/i.test(text)||/\bon\w+=/i.test(text)||/(?:href|src)=["']https?:/i.test(text)))suspect.push(f.packagePath+' (active/external SVG content)');
}
if(suspect.length)throw Error('Review secret/active-content patterns in: '+suspect.join(', '));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'payload/admin-ui/package.json'))),lock=JSON.parse(fs.readFileSync(path.join(root,'payload/admin-ui/package-lock.json')));
const deps={nodeUsedForIsolatedBuild:process.version,lockfileVersion:lock.lockfileVersion,runtime:{},development:{}};
for(const [section,target] of [['dependencies','runtime'],['devDependencies','development']])for(const [name,range] of Object.entries(pkg[section])){if(lock.packages[''].hasOwnProperty(section)&&lock.packages[''][section][name]!==range)throw Error('Manifest/lock mismatch');deps[target][name]={requested:range,locked:lock.packages['node_modules/'+name]?.version};}
fs.writeFileSync(path.join(root,'docs/DEPENDENCIES.json'),JSON.stringify(deps,null,2)+'\n');
const csv=['package_path,original_relative_path,scope,bytes,sha256'];
for(const f of origins)csv.push([f.packagePath,f.source,f.packagePath.startsWith('payload/')?'frontend-source':'backend-manual-reference',fs.statSync(path.join(root,f.packagePath)).size,f.sha256].join(','));
fs.writeFileSync(path.join(root,'docs/FILE-INVENTORY.csv'),csv.join('\n')+'\n');
fs.writeFileSync(path.join(root,'docs/PACKAGING-REPORT.json'),JSON.stringify({packageId:'starstream-update-2026-10-28',sourceBaselineAvailable:false,collectedFrontendFiles:origins.filter(f=>f.packagePath.startsWith('payload/')).length,backendReferenceFiles:origins.filter(f=>f.packagePath.startsWith('backend-reference/')).length,sourceBytesUnchanged:true,staticSecretPatternFindings:suspect,isolatedTypeScriptCheck:'passed',isolatedViteBuild:'passed',helperSyntax:'passed',installationScriptsExecuted:false,backupScriptsExecuted:false,rollbackScriptsExecuted:false,productionAccessed:false,databaseAccessed:false,cleanDependencyInstallTested:false,backendIntegrationTested:false},null,2)+'\n');
const list=walk(root).filter(p=>!['manifest.json','SHA256SUMS.txt'].includes(p));
for(const p of list)if(/(^|\/)(\.env(?:\.|$)|node_modules|vendor|dist|phpinfo\.php|\.git)(\/|$)|\.(sql|tsbuildinfo)$|\.before-|\.bak\./.test(p))throw Error('Forbidden archive entry '+p);
const manifest={packageId:'starstream-update-2026-10-28',preparedDate:'2026-10-28',timezone:'Asia/Manila',baselineAvailable:false,installationScope:'payload/admin-ui only; non-production review copy',files:list.map(p=>({path:p,bytes:fs.statSync(path.join(root,p)).size,sha256:hash(path.join(root,p)),scope:p.startsWith('payload/')?'payload':p.startsWith('backend-reference/')?'manual-reference':'support'}))};
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'SHA256SUMS.txt'),[...list,'manifest.json'].sort().map(p=>hash(path.join(root,p))+'  '+p).join('\n')+'\n');
console.log(JSON.stringify({files:manifest.files.length,sourceFilesVerified:origins.length,secretPatternFindings:suspect.length}));
