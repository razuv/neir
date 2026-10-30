import {MAX_UPLOAD,MEDIA_TYPES,validateContent} from './validation.mjs';
const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const json=(data,status=200,headers={})=>Response.json(data,{status,headers});
async function passwordMatches(password,encoded){
  const [algorithm,rounds,salt,expected]=(encoded||'').split('$');
  if(algorithm!=='pbkdf2_sha256'||Number(rounds)!==100000||!salt||!expected)return false;
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),{name:'PBKDF2'},false,['deriveBits']);
  const actual=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:Number(rounds),salt:Uint8Array.from(atob(salt),c=>c.charCodeAt(0))},key,256));
  let difference=actual.length^expected.length;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);return difference===0;
}
async function session(request,env){
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const hash=await digest(token);const row=await env.DB.prepare('SELECT token_hash FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(hash,Date.now()).first();
  return row?hash:null;
}
async function limitedJSON(request,max=600000){
  if(Number(request.headers.get('Content-Length'))>max)throw Error('Слишком большой запрос.');
  const reader=request.body?.getReader();let size=0;const chunks=[];
  if(!reader)throw Error('Пустой запрос.');
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Слишком большой запрос.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
async function route(request,env){
  const url=new URL(request.url);const now=Date.now();
  if(url.pathname==='/health')return json({ok:true});
  if(url.pathname==='/content'&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT payload, revision FROM content WHERE id = ?').bind('main').first();
    return json({content:row?JSON.parse(row.payload):null,revision:row?.revision||0},200,{'Cache-Control':'no-store'});
  }
  if((url.pathname.startsWith('/media/')||url.pathname.startsWith('/assets/'))&&['GET','HEAD'].includes(request.method)){
    const asset=url.pathname.startsWith('/assets/');const name=url.pathname.slice(asset?8:7);
    if(!(asset?/^video-[1-7]\.(mp4|mov)$/:/^[a-f0-9-]{36}\.(jpg|png|webp|avif|gif|mp4|webm|mov)$/).test(name))return json({error:'Файл не найден.'},404);
    const key=asset?'original/'+name:name;
    const object=await env.MEDIA.get(key,{range:request.headers});if(!object)return json({error:'Файл не найден.'},404);
    const headers=new Headers();object.writeHttpMetadata(headers);headers.set('ETag',object.httpEtag);headers.set('Accept-Ranges','bytes');headers.set('Cache-Control','public,max-age=31536000,immutable');headers.set('X-Content-Type-Options','nosniff');
    let status=200;if(object.range&&'offset' in object.range){const {offset,length}=object.range;status=206;headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);headers.set('Content-Length',String(length));}else headers.set('Content-Length',String(object.size));
    return new Response(request.method==='HEAD'?null:object.body,{status,headers});
  }
  if(url.pathname==='/login'&&request.method==='POST'){
    if(!env.ADMIN_PASSWORD_HASH)return json({error:'Вход ещё не настроен.'},503);
    const input=await limitedJSON(request,1500);
    if(typeof input.username!=='string'||typeof input.password!=='string'||input.password.length>256)return json({error:'Некорректный запрос.'},400);
    const ip=request.headers.get('CF-Connecting-IP')||'local';const bucket=Math.floor(now/900000);
    const limits=await env.DB.batch([`ip:${await digest(ip)}:${bucket}`,`global:${bucket}`].map(id=>env.DB.prepare('INSERT INTO login_limits(id,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(id,now+1800000)));
    if(limits[0].results[0].attempts>10||limits[1].results[0].attempts>100)return json({error:'Слишком много попыток. Попробуйте через 15 минут.'},429,{'Retry-After':'900'});
    const valid=await passwordMatches(input.password,env.ADMIN_PASSWORD_HASH);
    if(input.username!=='neiradmin'||!valid)return json({error:'Неверный логин или пароль.'},401);
    const token=hex(crypto.getRandomValues(new Uint8Array(32)));const expiresAt=now+8*60*60*1000;
    await env.DB.batch([env.DB.prepare('INSERT INTO sessions(token_hash,expires_at) VALUES (?,?)').bind(await digest(token),expiresAt),env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),env.DB.prepare('DELETE FROM login_limits WHERE expires_at < ?').bind(now)]);
    return json({token,expiresAt},200,{'Cache-Control':'no-store'});
  }
  const auth=await session(request,env);if(!auth)return json({error:'Войдите в админку.'},401);
  if(url.pathname==='/session'&&request.method==='GET')return json({username:'neiradmin'});
  if(url.pathname==='/logout'&&request.method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(auth).run();return json({ok:true});}
  if(url.pathname==='/content'&&request.method==='PUT'){
    const input=await limitedJSON(request);validateContent(input.content,url.origin);
    if(!Number.isInteger(input.revision)||input.revision<0)return json({error:'Не указана версия документа.'},400);
    const result=input.revision===0
      ? await env.DB.prepare('INSERT INTO content(id,payload,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING RETURNING revision').bind('main',JSON.stringify(input.content),now).first()
      : await env.DB.prepare('UPDATE content SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? RETURNING revision').bind(JSON.stringify(input.content),now,'main',input.revision).first();
    if(!result)return json({error:'Контент уже изменён в другой вкладке. Сохраните локальную копию и обновите страницу.'},409);
    return json({ok:true,revision:result.revision},200,{'Cache-Control':'no-store'});
  }
  if(url.pathname==='/media'&&request.method==='POST'){
    const type=request.headers.get('Content-Type')?.split(';')[0];const extension=MEDIA_TYPES.get(type);const size=Number(request.headers.get('Content-Length'));
    if(!extension)return json({error:'Поддерживаются JPG, PNG, WebP, AVIF, GIF, MP4, WebM и MOV.'},415);
    if(!Number.isFinite(size)||size<=0||size>MAX_UPLOAD)return json({error:'Размер файла должен быть от 1 байта до 95 МБ.'},413);
    const key=crypto.randomUUID()+'.'+extension;
    // Stream uploads directly into R2 instead of buffering a video in Worker memory.
    await env.MEDIA.put(key,request.body,{httpMetadata:{contentType:type}});
    return json({url:url.origin+'/media/'+key,type:type.startsWith('image/')?'image':'video'},201);
  }
  return json({error:'Страница не найдена.'},404);
}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(origin&&!allowed.includes(origin))return json({error:'Origin not allowed.'},403);
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Vary':'Origin'};
  if(origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,OPTIONS','Access-Control-Max-Age':'600'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  try{const response=await route(request,env);const result=new Response(response.body,response);for(const [key,value] of Object.entries(headers))if(key!=='Cache-Control'||!result.headers.has(key))result.headers.set(key,value);return result;}
  catch(error){if(error instanceof SyntaxError)return json({error:'Некорректный JSON.'},400,headers);if(error.message?.startsWith('D1_')||error.message?.includes('R2'))return json({error:'Сервис временно недоступен.'},503,headers);return json({error:error.message||'Ошибка запроса.'},400,headers);}
}};
