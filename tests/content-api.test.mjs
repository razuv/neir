import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pbkdf2Sync} from 'node:crypto';
import vm from 'node:vm';
import worker from '../backend/worker.mjs';
import {validateContent} from '../backend/validation.mjs';
const ctx={window:{}};vm.runInNewContext(readFileSync(new URL('../content-defaults.js',import.meta.url),'utf8'),ctx);
const content=JSON.parse(JSON.stringify(ctx.window.NEIR_DEFAULTS));
const base='https://neir-api.example';const origin='https://razuv.github.io';
const password='Test-only-long-random-password-123456';
function environment(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../backend/schema.sql',import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async run(){return sql.prepare(query).run(...args);},async all(){return {results:sql.prepare(query).all(...args)};}};}};},async batch(statements){const result=[];sql.exec('BEGIN');try{for(const stmt of statements){if(stmt.all){try{result.push(await stmt.all());}catch{result.push(await stmt.run());}}else result.push(await stmt.run());}sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 const salt=Buffer.from('local-test-salt');const hash=pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
 const objects=new Map();
 return {DB,ALLOWED_ORIGINS:origin,ADMIN_PASSWORD_HASH:`pbkdf2_sha256$100000$${salt.toString('base64')}$${hash}`,MEDIA:{async put(key,body,metadata){const bytes=await new Response(body).arrayBuffer();objects.set(key,{bytes,metadata});},async get(key){const object=objects.get(key);return object?{body:object.bytes,size:object.bytes.byteLength,httpEtag:'"test"',writeHttpMetadata(headers){headers.set('Content-Type',object.metadata.httpMetadata.contentType);}}:null;}},objects};
}
async function req(env,path,method='GET',body,token){const headers={Origin:origin};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';return worker.fetch(new Request(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);}
async function login(env){const response=await req(env,'/login','POST',{username:'neiradmin',password});assert.equal(response.status,200);return (await response.json()).token;}
test('content schema rejects unsafe media URLs and malformed rows',()=>{
 assert.doesNotThrow(()=>validateContent(content,base));
 const changed=structuredClone(content);changed.cases[0].media=[{type:'image',url:'javascript:alert(1)',name:'x',alt:''}];assert.throws(()=>validateContent(changed,base));
 changed.cases[0].media=[{type:'image',url:'https://untrusted.example/x.png',name:'x',alt:''}];assert.throws(()=>validateContent(changed,base));
 changed.cases[0].media=[];changed.services[0][5]='<svg>';assert.throws(()=>validateContent(changed,base));
});
test('unauthenticated writes and wrong passwords are rejected',async()=>{
 const env=environment();assert.equal((await req(env,'/content','PUT',{content,revision:0})).status,401);
 assert.equal((await req(env,'/login','POST',{username:'neiradmin',password:'wrong'})).status,401);
 const evil=new Request(base+'/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({username:'neiradmin',password})});assert.equal((await worker.fetch(evil,env)).status,403);
});
test('save persists all text, protects revisions, and logout revokes session',async()=>{
 const env=environment();const token=await login(env);
 const save=await req(env,'/content','PUT',{content,revision:0},token);assert.equal(save.status,200);assert.equal((await save.json()).revision,1);
 assert.equal((await req(env,'/content','PUT',{content,revision:0},token)).status,409);
 const edited=structuredClone(content);edited.cases[0].title='Обновлённый кейс';assert.equal((await req(env,'/content','PUT',{content:edited,revision:1},token)).status,200);
 const publicData=await (await req(env,'/content')).json();assert.equal(publicData.content.cases[0].title,'Обновлённый кейс');assert.equal(publicData.revision,2);
 assert.equal((await req(env,'/logout','POST',undefined,token)).status,200);assert.equal((await req(env,'/session','GET',undefined,token)).status,401);
});
test('rate limit blocks repeated login attempts',async()=>{const env=environment();for(let i=0;i<10;i++)assert.equal((await req(env,'/login','POST',{username:'neiradmin',password:'wrong'})).status,401);assert.equal((await req(env,'/login','POST',{username:'neiradmin',password})).status,429);});
test('only authenticated supported uploads are public and password hash never appears',async()=>{
 const env=environment();const token=await login(env);const bytes=Buffer.from([137,80,78,71]);
 const headers={Origin:origin,Authorization:'Bearer '+token,'Content-Type':'image/png','Content-Length':String(bytes.length)};
 const response=await worker.fetch(new Request(base+'/media',{method:'POST',headers,body:bytes}),env);assert.equal(response.status,201);const upload=await response.json();assert.equal(upload.type,'image');const media=await req(env,new URL(upload.url).pathname);assert.equal(media.status,200);assert.equal(media.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await media.arrayBuffer()),bytes);
 const unsupported=await worker.fetch(new Request(base+'/media',{method:'POST',headers:{...headers,'Content-Type':'image/svg+xml'},body:bytes}),env);assert.equal(unsupported.status,415);
 const published=await (await req(env,'/content')).text();assert.ok(!published.includes('ADMIN_PASSWORD_HASH'));assert.ok(!published.includes(password));
});
