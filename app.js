const config=window.NEIR_CONFIG;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const crops={woman:[1045,850,215,382],chicken:[1045,1738,215,383],samokat:[785,1295,574,383],event:[785,2182,575,383],side:[1284,870,85,340],pet:[974,3230,215,340]};
function art(key,cls='wide',alt=''){const [x,y,w]=crops[key];return `<div class="art ${cls}" style="--crop-x:${x};--crop-y:${y};--crop-w:${w}"><img src="public/reference.webp" alt="${esc(alt)}" loading="lazy" decoding="async" width="1440" height="3761"></div>`;}
const services=window.NEIR_CONTENT.services || window.NEIR_DEFAULTS.services;
$('#services').innerHTML=services.map(([name,price,description,tags,cta,img],i)=>{const wide=['samokat','event'].includes(img);return `<details class="service ${wide?'landscape':''}" ${i===0?'open':''}><div class="service-inner"><summary><h2>${esc(name)}</h2><span class="price">от ${esc(price)} ₽</span><span class="toggle"><span class="open-label">Подробнее</span><span class="close-label">Скрыть</span></span></summary><div class="service-content"><div class="service-copy"><p>${esc(description)}</p><div class="tags">${tags.split('|').map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="action-row"><a href="#contact" class="button" data-service="${esc(name)}">${esc(cta)} <i></i></a><span class="price">от ${esc(price)} ₽</span></div></div><div class="service-media">${wide?art(img,'wide',img==='samokat'?'Самокат — event-фотосъёмка':'Арх Москва — фотосъёмка выставки'):art('side','side')+art(img,'portrait','Пример визуала из макета NEIR MEDIA')+art('side','side')}</div></div></div></details>`}).join('');
// Summary must be the first direct child of details for native keyboard interaction.
$$('.service').forEach(el=>{const inner=$('.service-inner',el);const summary=$('summary',inner);el.insertBefore(summary,inner);summary.classList.add('wrap');});
$$('.offer-art').forEach(el=>{const pet=el.dataset.art==='pet';el.innerHTML=`<div class="offer-composition">${art(pet?'woman':'side','offer-side')}${art(pet?'pet':'chicken','offer-center')}${art('woman','offer-side')}</div>`;});
const cmsCases=window.NEIR_CONTENT.cases || window.NEIR_DEFAULTS.cases;
const cases=cmsCases.map(c=>[c.title,c.tags,c.description,c.result,c.crop]);
function caseCover(c) {
 const first=c.media?.[0];
 if(first?.type==='image')return `<img class="case-cover-image" src="${esc(first.url)}" alt="${esc(first.alt||c.title)}" loading="lazy" decoding="async">`;
 if(first?.type==='video')return `<span class="case-wordmark">${esc(c.title)}</span><span class="case-video-mark" aria-hidden="true">▶</span>`;
 return c.crop?art(c.crop,'wide',c.title):`<span class="case-wordmark">${esc(c.title)}</span>`;
}
$('#case-grid').innerHTML=cmsCases.map((c,i)=>`<article class="case-card"><button class="case-preview" data-case="${i}" aria-label="Открыть кейс ${esc(c.title)}">${caseCover(c)}</button><h3>${esc(c.title)}</h3><p>${esc(c.tags)}</p></article>`).join('');
$('.all-cases').addEventListener('click',e=>{const open=$('#case-grid').classList.toggle('expanded');e.currentTarget.setAttribute('aria-expanded',open);e.currentTarget.innerHTML=`${open?'Скрыть кейсы':'Показать все кейсы'} <span>${open?'−':'+'}</span>`;});
const dialog=$('#detail-dialog');
function showDialog(html){$('#dialog-content').innerHTML=html;dialog.showModal();}
$('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$$('[data-case]').forEach(b=>b.addEventListener('click',()=>{
 const c=cmsCases[Number(b.dataset.case)];
 const media=(c.media||[]).map(m=>m.type==='image'?`<figure><img src="${esc(m.url)}" alt="${esc(m.alt||c.title)}" loading="lazy"><figcaption>${esc(m.alt)}</figcaption></figure>`:`<figure><video src="${esc(m.url)}" controls playsinline preload="none" aria-label="${esc(m.alt||c.title)}"></video><figcaption>${esc(m.alt)}</figcaption></figure>`).join('');
 showDialog(`<p class="eyebrow">${esc(c.tags)}</p><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><div class="case-media-list">${media}</div><h3>Результат</h3><p>${esc(c.result)}</p><a class="button" href="#contact" data-service="${esc('Проект, похожий на '+c.title)}">Хочу похожий проект <i></i></a>`);
 track('case_click',{case:c.title});
}));
dialog.addEventListener('close',()=>$$('video',dialog).forEach(video=>video.pause()));
const audiences=window.NEIR_CONTENT.audiences || window.NEIR_DEFAULTS.audiences;
$('#audiences').innerHTML=audiences.map(([h,p])=>`<article><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('');
const reasons=window.NEIR_CONTENT.reasons || window.NEIR_DEFAULTS.reasons;
$('#reasons').innerHTML=reasons.map(([h,p],i)=>`<article class="reason"><span>0${i+1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('');
const names=window.NEIR_CONTENT.names || window.NEIR_DEFAULTS.names;
$('.marquee').innerHTML=[0,1].map(i=>names.map(n=>`<span ${i?'aria-hidden="true"':''}>${esc(n)}</span>`).join('')).join('');
const steps=window.NEIR_CONTENT.steps || window.NEIR_DEFAULTS.steps;
$('#steps').innerHTML=steps.map(([h,p],i)=>`<article class="step"><span>0${i+1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('');
$('#year').textContent=new Date().getFullYear();
if(config.telegram) $$('[data-telegram]').forEach(a=>{a.href=config.telegram;a.hidden=false;a.target='_blank';a.rel='noopener';});
function track(goal,params={}){if(config.metrikaId&&typeof window.ym==='function')window.ym(config.metrikaId,'reachGoal',goal,params);}
document.addEventListener('click',e=>{const c=e.target.closest('[data-service]');if(c){$('#brief [name=task]').value=c.dataset.service;if(dialog.open)dialog.close();track(c.dataset.service.includes('Academy')?'academy_click':c.dataset.service.includes('Социальный')?'social_offer_click':c.dataset.service.includes('сериал')?'animation_offer_click':'service_click',{service:c.dataset.service});}const a=e.target.closest('a');if(a){const href=a.getAttribute('href')||'';if(href.startsWith('tel:'))track('phone_click');if(href.includes('wa.me'))track('whatsapp_click');if(a.hasAttribute('data-telegram'))track('telegram_click');}});
$$('[data-legal]').forEach(b=>b.addEventListener('click',()=>{if(config.privacyUrl){location.href=config.privacyUrl;return;}showDialog('<h2>Обработка персональных данных</h2><p>Форма подготавливает письмо в вашем почтовом приложении. Данные не сохраняются на сайте и не отправляются автоматически.</p><p>Укажите только сведения, необходимые для обсуждения проекта. Получатель письма: nikonorov5059@gmail.com.</p><p class="muted">Политика конфиденциальности и реквизиты оператора будут добавлены перед подключением отправки заявок через сайт.</p>');}));
const form=$('#brief');
if(config.formEndpoint&&config.privacyUrl&&config.consentUrl){$('#submit').innerHTML='Отправить заявку <i></i>';$('#form-status').textContent='Свяжемся с вами, чтобы обсудить детали.';}
form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form));const status=$('#form-status');if(!config.formEndpoint||!config.privacyUrl||!config.consentUrl){const body=`Имя: ${data.name}\nКомпания / проект: ${data.company}\nКонтакт: ${data.contact}\nЗадача: ${data.task}\nСрок: ${data.deadline}\nБюджет: ${data.budget}`;window.location.href=`mailto:${config.email}?subject=${encodeURIComponent('Заявка на проект NEIR MEDIA')}&body=${encodeURIComponent(body)}`;status.textContent='Письмо подготовлено. Отправьте его в почтовом приложении. Если приложение не открылось, напишите на '+config.email;track('email_draft');return;}const button=$('#submit');button.disabled=true;status.textContent='Отправляем…';try{const res=await fetch(config.formEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!res.ok)throw new Error('Request failed');status.textContent='Спасибо! Мы получили заявку и свяжемся с вами в ближайшее время.';form.reset();track('form_submit');}catch{status.textContent='Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с нами по телефону.';}finally{button.disabled=false;}});
// Аналитика активируется только после настройки ID и согласия пользователя.
if(config.metrikaId){const banner=document.createElement('div');banner.className='cookie-banner';banner.innerHTML='<p>Разрешить cookies и Яндекс.Метрику для анализа работы сайта?</p><button class="button" data-cookie="yes">Разрешить</button><button class="text-button" data-cookie="no">Отклонить</button>';let choice;try{choice=localStorage.getItem('neir-analytics');}catch{}function enable(){window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments)};window.ym.l=Date.now();const s=document.createElement('script');s.async=true;s.src='https://mc.yandex.ru/metrika/tag.js';document.head.append(s);window.ym(config.metrikaId,'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true});const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){track(entry.target.id+'_view');observer.unobserve(entry.target);}}),{threshold:.15});['services','cases'].forEach(id=>observer.observe(document.getElementById(id)));const reached=new Set();addEventListener('scroll',()=>{const depth=(scrollY+innerHeight)/document.documentElement.scrollHeight*100;[25,50,75,100].forEach(n=>{if(depth>=n&&!reached.has(n)){reached.add(n);track('scroll_'+n);}});},{passive:true});}if(choice==='yes')enable();else if(!choice){document.body.append(banner);$$('[data-cookie]',banner).forEach(b=>b.addEventListener('click',()=>{try{localStorage.setItem('neir-analytics',b.dataset.cookie);}catch{}if(b.dataset.cookie==='yes')enable();banner.remove();}));}}
