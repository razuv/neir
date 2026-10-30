import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,access,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {buildSite,pagesConfig} from '../scripts/build.mjs';
test('Pages builds standalone, validates an optional API, and normalizes the repository path',()=>{
 for(const value of ['http://localhost:8787','https://user:pass@example.com','https://api.example.com/path','https://api.example.com/?secret=x'])assert.throws(()=>pagesConfig(value));
 assert.equal(pagesConfig('').apiURL,'');
 assert.deepEqual(pagesConfig('https://api.example.com/','https://razuv.github.io/neir'),{apiURL:'https://api.example.com',pagesURL:'https://razuv.github.io/neir/',basePath:'/neir/'});
});
test('Pages artifact supports a project subpath and excludes credentials and original videos',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'neir-pages-'));
 try{
  await buildSite({outDir:temp,pages:true,apiURL:'https://api.example.com',pagesURL:'https://razuv.github.io/neir/'});
  const files=await readdir(temp);
  assert.ok(files.includes('.nojekyll'));assert.ok(files.includes('visual-editor.js'));
  for(const forbidden of ['.admin-credentials','backend','node_modules','.github','server.mjs'])assert.ok(!files.includes(forbidden));
  const media=await readdir(path.join(temp,'public/media'));assert.ok(!media.some(file=>/\.(mp4|mov)$/i.test(file)));
  const runtime=await readFile(path.join(temp,'runtime-config.js'),'utf8');assert.ok(runtime.includes('https://api.example.com'));assert.ok(!runtime.includes('8787'));const context={window:{}};vm.runInNewContext(runtime,context);assert.equal(context.window.NEIR_MEDIA_URL('video-3.mov'),'https://api.example.com/assets/video-3.mov');
  const html=await readFile(path.join(temp,'index.html'),'utf8');assert.ok(html.includes('https://api.example.com/assets/video-4.mp4'));assert.ok(html.includes('https://razuv.github.io/neir/'));assert.ok(!html.includes('src="/'));
  const admin=await readFile(path.join(temp,'admin/index.html'),'utf8');assert.ok(admin.includes('../runtime-config.js'));assert.ok(admin.includes('noindex,nofollow'));
  for(const source of ['bootstrap.js','content-defaults.js','admin/admin.js','admin/admin.css'])await access(path.join(temp,source));
  assert.ok((await readFile(path.join(temp,'robots.txt'),'utf8')).includes('Disallow: /neir/admin/'));
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('standalone Pages artifact opens without Cloudflare and includes optimized videos',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'neir-static-pages-'));
 try{
  await buildSite({outDir:temp,pages:true,apiURL:''});
  const runtime=await readFile(path.join(temp,'runtime-config.js'),'utf8');
  assert.ok(runtime.includes('NEIR_API_URL=""'));assert.ok(runtime.includes('public/pages-media/'));assert.ok(!runtime.includes('8787'));const context={window:{}};vm.runInNewContext(runtime,context);assert.equal(context.window.NEIR_MEDIA_URL('video-3.mov'),'public/pages-media/video-3.mp4');
  const html=await readFile(path.join(temp,'index.html'),'utf8');assert.ok(html.includes('src="public/pages-media/video-4.mp4"'));
  for(let i=1;i<=7;i++)await access(path.join(temp,`public/pages-media/video-${i}.mp4`));
 }finally{await rm(temp,{recursive:true,force:true});}
});
