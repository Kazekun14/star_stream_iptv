#!/usr/bin/env node
'use strict';
// Source integration helper for a manually marked NON-PRODUCTION review copy only.
// No dependency installation, builds, networking, API calls, database changes, or deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const digest=p=>sha(fs.readFileSync(p));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const fail=m=>{throw Error(m);};
function inside(base,p){return p===base||p.startsWith(base+path.sep);}
function safe(base,rel){
  if(typeof rel!=='string'||!rel||rel.includes('\\')||rel.includes(':')||path.posix.isAbsolute(rel)||rel.split('/').some(p=>p==='..'||p==='.'||!p))fail('Unsafe relative path');
  const out=path.resolve(base,...rel.split('/'));if(!inside(base,out))fail('Path escape');
  let cur=base;
  for(const part of ['',...rel.split('/')]){if(part)cur=path.join(cur,part);if(fs.existsSync(cur)&&fs.lstatSync(cur).isSymbolicLink())fail('Symlink/junction refused: '+cur);}
  return out;
}
function regular(p){if(!fs.existsSync(p))return null;const st=fs.lstatSync(p);if(!st.isFile()||st.isSymbolicLink())fail('Expected regular file: '+p);return st;}
function files(base,rel=''){let out=[];for(const e of fs.readdirSync(path.join(base,rel),{withFileTypes:true})){const p=rel?rel+'/'+e.name:e.name;if(e.isSymbolicLink())fail('Package link refused');if(e.isDirectory())out.push(...files(base,p));else out.push(p);}return out.sort();}
function verify(){
  const manifest=read(path.join(ROOT,'manifest.json'));
  const actual=files(ROOT).filter(p=>p!=='manifest.json'&&p!=='SHA256SUMS.txt');
  const expected=manifest.files.map(f=>f.path).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))fail('Package contains missing or unexpected files');
  for(const f of manifest.files){const p=safe(ROOT,f.path);regular(p);if(digest(p)!==f.sha256||fs.statSync(p).size!==f.bytes)fail('Integrity mismatch: '+f.path);}
  const sums=fs.readFileSync(path.join(ROOT,'SHA256SUMS.txt'),'utf8').trim().split(/\r?\n/);
  const sumPaths=[];for(const line of sums){const m=/^([a-f0-9]{64})  (.+)$/.exec(line);if(!m||digest(safe(ROOT,m[2]))!==m[1])fail('SHA256SUMS mismatch');sumPaths.push(m[2]);}
  if(JSON.stringify(sumPaths.sort())!==JSON.stringify([...expected,'manifest.json'].sort()))fail('Incomplete checksum inventory');
  return manifest;
}
function targetRoot(value,write=false){
  if(!value)fail('--target is required (project root containing admin-ui)');
  const p=path.resolve(value);if(!fs.existsSync(p)||fs.realpathSync(p)!==p)fail('Target must be an existing real directory without symlink aliases');
  if(inside(ROOT,p)||inside(p,ROOT))fail('Target and package must be separate trees');
  regular(safe(p,'admin-ui/package.json'))||fail('Target is not a project root');
  if(write){const marker=safe(p,'.starstream-review-copy');if(!regular(marker)||fs.readFileSync(marker,'utf8').trim()!=='NON_PRODUCTION_REVIEW_COPY')fail('Writes require the manually created non-production review-copy marker');}
  return p;
}
function plan(manifest,target){
  const entries=manifest.files.filter(f=>f.path.startsWith('payload/')).map(f=>{
    const rel=f.path.slice(8);if(!rel.startsWith('admin-ui/'))fail('Unsupported payload scope');
    const dest=safe(target,rel),st=regular(dest),before=st?digest(dest):null;
    return {path:rel,before,after:f.sha256,action:before===f.sha256?'unchanged':before===null?'add':'replace'};
  });
  const data={packageId:manifest.packageId,manifestHash:digest(path.join(ROOT,'manifest.json')),target,entries};
  return {...data,reviewHash:sha(JSON.stringify(data))};
}
function snapshot(p,base){
  if(!base)fail('--backup-dir required');const parent=path.resolve(base);
  if(!fs.existsSync(parent)||fs.realpathSync(parent)!==parent)fail('Backup parent must be an existing real directory');
  if(inside(p.target,parent)||inside(parent,p.target)||inside(ROOT,parent)||inside(parent,ROOT))fail('Backup parent must be separate from target and package');
  const dir=path.join(parent,'starstream-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(dir,{mode:0o700});
  const entries=p.entries.filter(e=>e.action!=='unchanged').map(e=>{
    const original=safe(p.target,e.path),st=regular(original);
    if((st?digest(original):null)!==e.before)fail('Target changed while preparing backup');
    if(st){const dest=safe(dir,'files/'+e.path);fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});fs.copyFileSync(original,dest);fs.chmodSync(dest,0o600);if(digest(dest)!==e.before)fail('Backup verification failed');}
    return {...e,mode:st?st.mode&0o777:null,mtime:st?st.mtimeMs:null};
  });
  fs.writeFileSync(path.join(dir,'backup.json'),JSON.stringify({packageId:p.packageId,target:p.target,manifestHash:p.manifestHash,reviewHash:p.reviewHash,entries},null,2),{flag:'wx',mode:0o600});
  return dir;
}
function install(manifest,target,args){
  if(!args.reviewed||!args.plan)fail('Apply requires --reviewed and --plan pointing to the reviewed plan');
  const current=plan(manifest,target),approved=read(args.plan);
  if(approved.reviewHash!==current.reviewHash)fail('Package/target changed since review; create and review a new plan');
  const backup=snapshot(current,args['backup-dir']);
  console.error('Verified backup: '+backup);
  for(const e of current.entries.filter(e=>e.action!=='unchanged')){
    const dest=safe(target,e.path),st=regular(dest);
    if((st?digest(dest):null)!==e.before)fail('Target changed during apply; stop and inspect backup '+backup);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    const temp=dest+'.starstream-'+crypto.randomBytes(6).toString('hex');
    try{fs.copyFileSync(safe(ROOT,'payload/'+e.path),temp,fs.constants.COPYFILE_EXCL);fs.chmodSync(temp,st?st.mode&0o777:0o644);fs.renameSync(temp,dest);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
    if(digest(dest)!==e.after)fail('Write verification failed; inspect backup '+backup);
  }
  console.log('Source files copied into review copy only. Backup: '+backup);
}
function rollback(manifest,target,args){
  if(!args.reviewed||!args.backup)fail('Rollback requires --reviewed and --backup');
  const dir=path.resolve(args.backup);if(fs.realpathSync(dir)!==dir)fail('Backup must not be a link');
  const data=read(safe(dir,'backup.json'));
  if(data.target!==target||data.packageId!==manifest.packageId||data.manifestHash!==digest(path.join(ROOT,'manifest.json')))fail('Backup belongs to another target/package');
  const allowed=new Map(plan(manifest,target).entries.map(e=>[e.path,e.after]));
  const seen=new Set();
  for(const e of data.entries){
    if(seen.has(e.path)||allowed.get(e.path)!==e.after)fail('Invalid backup entry');seen.add(e.path);
    const dest=safe(target,e.path),st=regular(dest),now=st?digest(dest):null;
    if(now!==e.after&&now!==e.before)fail('Later edits detected; restore manually: '+e.path);
    if(e.before!==null&&digest(safe(dir,'files/'+e.path))!==e.before)fail('Corrupt backup: '+e.path);
  }
  for(const e of data.entries){
    const dest=safe(target,e.path);if(e.before===null){if(fs.existsSync(dest))fs.unlinkSync(dest);}
    else {fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(safe(dir,'files/'+e.path),dest);if(Number.isInteger(e.mode))fs.chmodSync(dest,e.mode);if(e.mtime)fs.utimesSync(dest,new Date(e.mtime),new Date(e.mtime));if(digest(dest)!==e.before)fail('Restore verification failed');}
  }
  console.log('Source rollback complete. Empty directories may remain. Dependencies/builds/database were not restored.');
}
try{
  const [command='help',...rest]=process.argv.slice(2),args={};
  for(let i=0;i<rest.length;i++){if(!rest[i].startsWith('--'))fail('Use named options');const k=rest[i].slice(2);args[k]=k==='reviewed'?true:rest[++i];}
  if(command==='help'){console.log('Commands: verify | plan --target ROOT | backup --target ROOT --backup-dir DIR | apply --target ROOT --plan FILE --backup-dir DIR --reviewed | rollback --target ROOT --backup DIR --reviewed\nRead README.md before using any write command.');process.exit(0);}
  const manifest=verify();
  if(command==='verify'){console.log('Package integrity verified: '+manifest.files.length+' files');process.exit(0);}
  if(!['plan','backup','apply','rollback'].includes(command))fail('Unknown command');
  const target=targetRoot(args.target,command!=='plan');
  if(command==='plan')console.log(JSON.stringify(plan(manifest,target),null,2));
  if(command==='backup')console.log(snapshot(plan(manifest,target),args['backup-dir']));
  if(command==='apply')install(manifest,target,args);
  if(command==='rollback')rollback(manifest,target,args);
}catch(error){console.error('STOP: '+error.message);process.exitCode=1;}
