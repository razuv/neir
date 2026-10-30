export const MAX_UPLOAD = 95 * 1024 * 1024;
export const MEDIA_TYPES = new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/avif','avif'],['image/gif','gif'],['video/mp4','mp4'],['video/webm','webm'],['video/quicktime','mov']]);
export function safeURL(value, apiOrigin='') {
  if (typeof value !== 'string' || value.length > 2000) return false;
  if (/^public\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return true;
  try { const u=new URL(value);const local=u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)&&u.origin===apiOrigin;return (u.protocol==='https:'||local)&&(!apiOrigin||u.origin===apiOrigin)&&!u.username&&!u.password; } catch { return false; }
}
export function validateContent(value,apiOrigin='') {
  if (!value || typeof value!=='object' || Array.isArray(value) || value.version!==1) throw Error('Некорректный формат контента.');
  const string=(v,max=10000)=>typeof v==='string'&&v.length<=max;
  if (!value.texts || Object.keys(value.texts).length>2500) throw Error('Некорректные тексты.');
  for(const [key,item] of Object.entries(value.texts)) {
    if(!/^t\d{4}$/.test(key)||!item||!string(item.text)||!string(item.section,80)) throw Error('Некорректное текстовое поле.');
  }
  if(!Array.isArray(value.cases)||value.cases.length>100)throw Error('Не больше 100 кейсов.');
  const ids=new Set();
  for(const c of value.cases) {
    if(!c||!string(c.id,100)||!c.id||ids.has(c.id)||!string(c.title,200)||!c.title.trim()||!string(c.tags,500)||!string(c.description)||!string(c.result)||!string(c.crop,30))throw Error('Проверьте поля кейсов.');
    ids.add(c.id);
    if(!Array.isArray(c.media)||c.media.length>40)throw Error('Не больше 40 медиа в одном кейсе.');
    for(const m of c.media)if(!m||!['image','video'].includes(m.type)||!safeURL(m.url,apiOrigin)||!string(m.name,250)||!string(m.alt,500))throw Error('Некорректный медиафайл.');
  }
  for(const [name,count] of [['services',7],['audiences',9],['reasons',7],['steps',5]]) {
    if(!Array.isArray(value[name])||value[name].length!==count||value[name].some(row=>!Array.isArray(row)||row.some(v=>!string(v))))throw Error(`Некорректный раздел ${name}.`);
  }
  if(value.services.some(row=>row.length!==6)||value.audiences.some(row=>row.length!==2)||value.reasons.some(row=>row.length!==2)||value.steps.some(row=>row.length!==2))throw Error('Некорректная структура разделов.');
  const crops=['','woman','chicken','samokat','event','side','pet'];
  if(value.services.some(row=>!crops.includes(row[5]))||value.cases.some(c=>!crops.includes(c.crop)))throw Error('Некорректное изображение.');
  if(!Array.isArray(value.names)||value.names.length>80||value.names.some(v=>!string(v,120)))throw Error('Некорректный список клиентов.');
  if(!value.settings||Object.values(value.settings).some(v=>!string(v,2000)))throw Error('Проверьте настройки.');
  for(const key of ['telegram','instagram'])if(value.settings[key]&&!/^https:\/\//.test(value.settings[key]))throw Error('Ссылки должны начинаться с https://.');
  if(JSON.stringify(value).length>500000)throw Error('Слишком большой объём текста.');
  return value;
}
