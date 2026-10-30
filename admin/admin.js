(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const api=(window.NEIR_API_URL||'').replace(/\/$/,'');
  const local=['localhost','127.0.0.1'].includes(location.hostname);
  if(local){$('#publish').textContent='Применить на локалке';$('#save-state').textContent='Изменения сохранены локально';}
  let token=sessionStorage.getItem('neir-admin-session')||'';
  let state,revision=0,dirty=false,uploads=0,currentTab='visual',selectedCase=0,draftTimer;
  const sections={top:'Первый экран',offers:'Спецпредложения',cases:'Кейсы',academy:'AI Academy',about:'О компании и команде',process:'Этапы работы',contact:'Контакты и форма',footer:'Подвал',Общее:'Навигация'};
  function notice(text,error=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',error);}
  function status(){
    $('#save-state').textContent=uploads?'Загружаем файлы…':dirty?'Есть несохранённые изменения':local?'Изменения сохранены локально':'Все изменения опубликованы';
    $('#publish').disabled=uploads>0||!dirty;
  }
  function changed(){updateCanvas();dirty=true;status();clearTimeout(draftTimer);draftTimer=setTimeout(()=>{
    try{localStorage.setItem('neir-content-draft',JSON.stringify({revision,content:state}));}catch{notice('Черновик не поместился в хранилище браузера. Скачайте копию контента.',true);}
  },300);}
  async function request(path,options={}){
    const response=await fetch(api+path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{}),...options.headers}});
    const data=await response.json().catch(()=>({error:'Сервис вернул некорректный ответ.'}));
    if(!response.ok){if(response.status===401&&path!=='/login'){sessionStorage.removeItem('neir-admin-session');token='';$('#workspace').hidden=true;$('#login-screen').hidden=false;}throw Error(data.error||'Не удалось выполнить запрос.');}
    return data;
  }
  async function start(){
    await request('/session');const saved=await request('/content');state=clone({...window.NEIR_DEFAULTS,...saved.content});revision=saved.revision;
    $('#login-screen').hidden=true;$('#workspace').hidden=false;
    try{const draft=JSON.parse(localStorage.getItem('neir-content-draft')||'null');$('#draft-banner').hidden=!draft;}catch{}
    render();status();
  }
  $('#login-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;const button=$('button[type=submit]',form);button.disabled=true;$('#login-status').textContent='Входим…';
    try{if(!api)throw Error('Сервис админки ещё не подключён.');const result=await request('/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});token=result.token;sessionStorage.setItem('neir-admin-session',token);form.elements.password.value='';await start();$('#login-status').textContent='';}catch(error){$('#login-status').textContent=error.message;}finally{button.disabled=false;}
  });
  async function confirm(title,message){
    const dialog=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;dialog.showModal();
    return new Promise(resolve=>{function done(value){dialog.close();$('#confirm-ok').onclick=null;$('#confirm-cancel').onclick=null;dialog.oncancel=null;resolve(value);}$('#confirm-ok').onclick=()=>done(true);$('#confirm-cancel').onclick=()=>done(false);dialog.oncancel=()=>done(false);});
  }
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{currentTab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',b===button?'page':'false'));render();}));
  function field(label,value,attrs='',multiline=false){return `<label>${e(label)}${multiline?`<textarea ${attrs} rows="3">${e(value)}</textarea>`:`<input ${attrs} value="${e(value)}">`}</label>`;}
  function render(){
    $('#panel-title').textContent={visual:'Редактор сайта',texts:'Тексты',services:'Услуги',cases:'Кейсы',settings:'Настройки'}[currentTab];
    document.body.classList.toggle('visual-workspace',currentTab==='visual');
    if(currentTab!=='visual'){canvasObserver?.disconnect();clearTimeout(canvasTimer);}
    if(currentTab==='visual')renderVisual();
    if(currentTab==='texts')renderTexts();if(currentTab==='services')renderServices();if(currentTab==='cases')renderCases();if(currentTab==='settings')renderSettings();
  }
  let visualSelection=null,canvasDevice='desktop',canvasEdit=true,canvasSignature='',canvasTimer,canvasObserver;
  const signature=()=>JSON.stringify({cases:state.cases.map(c=>[c.id,c.media]),names:state.names.length});
  const editorFrame=()=>$('#editor-frame');
  function sendEditor(type,extra={}){const frame=editorFrame();if(frame)frame.contentWindow.postMessage({type:'neir-editor:'+type,...extra},location.origin);}
  function resizeCanvas(){
    const stage=$('#canvas-stage'),frame=editorFrame(),viewport=$('#canvas-viewport');if(!stage||!frame)return;
    const width=canvasDevice==='mobile'?390:1440;
    const scale=Math.min(1,Math.max(0.15,(stage.clientWidth-24)/width));
    frame.style.width=width+'px';frame.style.height=Math.max(500,(stage.clientHeight-24)/scale)+'px';frame.style.transform=`scale(${scale})`;
    viewport.style.width=width*scale+'px';viewport.style.height=(stage.clientHeight-24)+'px';
    $('#canvas-scale').textContent=Math.round(scale*100)+'%';
  }
  function loadCanvas(y=0){
    const frame=editorFrame();if(!frame)return;
    try{sessionStorage.setItem('neir-preview',JSON.stringify(state));}catch{notice('Не удалось подготовить черновик. Скачайте копию контента.',true);return;}
    canvasSignature=signature();frame.dataset.scroll=String(y);
    const url=new URL('../',location.href);url.searchParams.set('cms-preview','1');url.searchParams.set('cms-editor','1');url.searchParams.set('v',Date.now());frame.src=url.href;
  }
  function updateCanvas(){
    clearTimeout(canvasTimer);
    if(currentTab!=='visual'||!editorFrame())return;
    canvasTimer=setTimeout(()=>{
      if(signature()!==canvasSignature){let y=0;try{y=editorFrame().contentWindow.scrollY;}catch{}loadCanvas(y);}
      else sendEditor('sync',{content:state});
    },160);
  }
  function renderVisual(){
    $('#panel').innerHTML=`<div class="visual-toolbar"><div class="device-buttons" aria-label="Размер экрана"><button type="button" data-device="desktop" aria-pressed="${canvasDevice==='desktop'}">Десктоп</button><button type="button" data-device="mobile" aria-pressed="${canvasDevice==='mobile'}">Телефон</button></div><select id="canvas-section" aria-label="Перейти к разделу"><option value="top">Первый экран</option><option value="services">Услуги</option><option value="offers">Спецпредложения</option><option value="cases">Кейсы</option><option value="academy">AI Academy</option><option value="about">О компании</option><option value="contact">Контакты</option></select><span id="canvas-scale" class="canvas-scale"></span><button type="button" id="canvas-mode" class="secondary" aria-pressed="${canvasEdit}">${canvasEdit?'Редактирование':'Просмотр'}</button><button type="button" id="visual-add-case" class="secondary">+ Кейс</button></div><p class="visual-hint">Нажмите на текст и печатайте прямо на странице. Нажмите на кейс, чтобы изменить его медиа.</p><div class="visual-layout"><div id="canvas-stage" class="canvas-stage"><div id="canvas-viewport"><iframe id="editor-frame" title="Визуальный редактор лендинга" sandbox="allow-scripts allow-same-origin allow-forms"></iframe></div></div><section id="visual-inspector" class="visual-inspector" aria-label="Настройки выбранного элемента"></section></div>`;
    document.querySelectorAll('[data-device]').forEach(button=>button.addEventListener('click',()=>{canvasDevice=button.dataset.device;document.querySelectorAll('[data-device]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));resizeCanvas();}));
    $('#canvas-section').addEventListener('change',event=>sendEditor('scroll',{id:event.target.value}));
    $('#canvas-mode').addEventListener('click',event=>{canvasEdit=!canvasEdit;event.currentTarget.setAttribute('aria-pressed',String(canvasEdit));event.currentTarget.textContent=canvasEdit?'Редактирование':'Просмотр';sendEditor('mode',{edit:canvasEdit});});
    $('#visual-add-case').addEventListener('click',()=>{const c={id:crypto.randomUUID(),title:'Новый кейс',tags:'',description:'',result:'',crop:'',media:[]};state.cases.push(c);selectedCase=state.cases.length-1;visualSelection={kind:'case',id:c.id};changed();renderInspector();sendEditor('scroll',{id:'cases'});});
    canvasObserver?.disconnect();canvasObserver=new ResizeObserver(resizeCanvas);canvasObserver.observe($('#canvas-stage'));
    loadCanvas();renderInspector();requestAnimationFrame(resizeCanvas);
  }
  function refValue(ref){
    if(ref?.kind==='text'&&Object.hasOwn(state.texts,ref.key))return state.texts[ref.key].text;
    if(ref?.kind==='service'&&Number.isInteger(ref.index)&&Number.isInteger(ref.column)&&ref.column>=0&&ref.column<5)return state.services[ref.index]?.[ref.column];
    if(ref?.kind==='list'&&['audiences','reasons','steps'].includes(ref.list)&&Number.isInteger(ref.index)&&[0,1].includes(ref.column))return state[ref.list][ref.index]?.[ref.column];
    if(ref?.kind==='name'&&Number.isInteger(ref.index))return state.names[ref.index];
    if(ref?.kind==='case'&&['title','tags','description','result'].includes(ref.field))return state.cases.find(c=>c.id===ref.id)?.[ref.field];
  }
  function setRef(ref,value){
    if(typeof value!=='string'||value.length>10000||refValue(ref)===undefined)return false;
    if(ref.kind==='text')state.texts[ref.key].text=value;
    if(ref.kind==='service')state.services[ref.index][ref.column]=value;
    if(ref.kind==='list')state[ref.list][ref.index][ref.column]=value;
    if(ref.kind==='name')state.names[ref.index]=value;
    if(ref.kind==='case')state.cases.find(c=>c.id===ref.id)[ref.field]=value;
    return true;
  }
  function inspectorField(label,ref,multiline=true){return field(label,refValue(ref)||'',`data-visual-ref="${e(JSON.stringify(ref))}"`,multiline);}
  function bindInspectorFields(){
    $('#visual-inspector').querySelectorAll('[data-visual-ref]').forEach(input=>input.addEventListener('input',()=>{if(setRef(JSON.parse(input.dataset.visualRef),input.value))changed();}));
  }
  function renderInspector(){
    const host=$('#visual-inspector');if(!host)return;
    const ref=visualSelection;
    if(!ref){host.innerHTML='<div class="inspector-empty"><span aria-hidden="true">↖</span><h2>Выберите элемент</h2><p>Нажмите на текст или кейс на странице слева. Здесь появятся его настройки.</p><p>Черновик виден сразу. Сохранение — по кнопке вверху.</p></div>';return;}
    if(ref.kind==='case'){
      const c=state.cases.find(c=>c.id===ref.id);if(!c){visualSelection=null;renderInspector();return;}
      selectedCase=state.cases.indexOf(c);
      host.innerHTML=`<p class="eyebrow">ВЫБРАН КЕЙС</p><h2>${e(c.title)}</h2><div class="inspector-fields">${[['title','Название'],['tags','Теги'],['description','Описание'],['result','Результат']].map(([key,label])=>inspectorField(label,{kind:'case',id:c.id,field:key})).join('')}</div><div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Загрузить фото и видео"><strong>Добавьте фото или видео</strong><span>Перетащите сюда или прямо на кейс.<br>До 95 МБ на файл.</span><input id="media-input" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime" aria-label="Выбрать файлы"></div><div id="upload-status" role="status"></div><div id="media-grid" class="media-grid"></div><div class="inspector-case-actions"><button type="button" id="visual-case-up" class="secondary" ${selectedCase===0?'disabled':''}>Выше</button><button type="button" id="visual-case-down" class="secondary" ${selectedCase===state.cases.length-1?'disabled':''}>Ниже</button><button type="button" id="visual-case-delete" class="danger">Удалить кейс</button></div>`;
      bindInspectorFields();renderMedia(c);attachMediaDropzone(c);
      for(const [id,offset]of[['visual-case-up',-1],['visual-case-down',1]])$('#'+id).addEventListener('click',()=>{const i=state.cases.indexOf(c),target=i+offset;[state.cases[i],state.cases[target]]=[state.cases[target],state.cases[i]];selectedCase=target;changed();renderInspector();});
      $('#visual-case-delete').addEventListener('click',async()=>{if(await confirm('Удалить кейс?',`«${c.title}» будет удалён из черновика.`)){state.cases.splice(state.cases.indexOf(c),1);visualSelection=null;changed();renderInspector();}});
      return;
    }
    if(ref.kind==='service'){
      const service=state.services[ref.index];if(!service)return;
      host.innerHTML=`<p class="eyebrow">ВЫБРАНА УСЛУГА</p><h2>${e(service[0])}</h2><div class="inspector-fields">${['Название','Цена, ₽','Описание','Форматы через |','Текст кнопки'].map((label,column)=>inspectorField(label,{kind:'service',index:ref.index,column},column>1)).join('')}</div>`;
    }else{
      const value=refValue(ref);if(value===undefined)return;
      host.innerHTML=`<p class="eyebrow">ВЫБРАН ТЕКСТ</p><h2>Редактирование</h2><div class="inspector-fields">${inspectorField('Текст на странице',ref)}</div><p class="help">Можно менять текст здесь или прямо на странице. Результат обновляется сразу.</p>`;
    }
    bindInspectorFields();
  }
  function attachMediaDropzone(c){
    const dropzone=$('#dropzone'),input=$('#media-input');
    dropzone.addEventListener('click',event=>{if(event.target!==input)input.click();});
    dropzone.addEventListener('keydown',event=>{if(event.target===dropzone&&['Enter',' '].includes(event.key)){event.preventDefault();input.click();}});
    input.addEventListener('change',()=>uploadFiles([...input.files],c));
    for(const name of ['dragenter','dragover'])dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.add('dragover');});
    dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop',event=>{event.preventDefault();dropzone.classList.remove('dragover');uploadFiles([...event.dataTransfer.files],c);});
  }
  window.addEventListener('message',event=>{
    const frame=editorFrame();if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin||!state)return;
    const message=event.data;if(!message||typeof message.type!=='string')return;
    if(message.type==='neir-editor:ready'){sendEditor('sync',{content:state});sendEditor('mode',{edit:canvasEdit});sendEditor('position',{y:Number(frame.dataset.scroll)||0});return;}
    if(message.type==='neir-editor:select'){
      const ref=message.ref;
      if(refValue(ref)!==undefined||(ref?.kind==='case'&&state.cases.some(c=>c.id===ref.id))){
        if(JSON.stringify(visualSelection)!==JSON.stringify(ref)){visualSelection=ref;renderInspector();}
      }
    }
    if(message.type==='neir-editor:change'&&setRef(message.ref,message.value)){
      changed();$('#visual-inspector')?.querySelectorAll('[data-visual-ref]').forEach(input=>{if(JSON.stringify(JSON.parse(input.dataset.visualRef))===JSON.stringify(message.ref)&&input!==document.activeElement)input.value=message.value;});
    }
    if(message.type==='neir-editor:files'&&Array.isArray(message.files)){
      const c=state.cases.find(c=>c.id===message.id);if(!c)return;visualSelection={kind:'case',id:c.id};renderInspector();uploadFiles(message.files.filter(file=>file instanceof File).slice(0,40),c);
    }
    if(message.type==='neir-editor:save')$('#publish').click();
  });

  function renderTexts(){
    $('#panel').innerHTML=`<p class="help">Изменяйте текст в полях ниже. Переносы строк сохранятся. Чтобы увидеть результат, нажмите «Предпросмотр», затем «Опубликовать».</p><div class="filters"><input id="text-search" placeholder="Найти текст…" aria-label="Поиск по текстам"><select id="section-filter" aria-label="Выбор раздела"><option value="">Все разделы</option>${Object.entries(sections).map(([key,name])=>`<option value="${e(key)}">${e(name)}</option>`).join('')}</select></div><div id="text-list"></div><div id="structured-texts"></div>`;
    function list(){
      const query=$('#text-search').value.toLocaleLowerCase();const section=$('#section-filter').value;
      const groups=new Map();
      Object.entries(state.texts).forEach(([key,item])=>{if(section&&item.section!==section)return;if(query&&!item.text.toLocaleLowerCase().includes(query))return;const group=groups.get(item.section)||[];group.push([key,item]);groups.set(item.section,group);});
      $('#text-list').innerHTML=[...groups].map(([section,items])=>`<article class="text-group"><h2>${e(sections[section]||section)}</h2><div class="text-fields">${items.map(([key,item])=>`<label class="text-field"><span class="field-title">${e(item.text.replace(/\s+/g,' ').slice(0,70))}</span><textarea data-text="${key}" rows="${item.text.length>160?4:2}">${e(item.text)}</textarea></label>`).join('')}</div></article>`).join('')||'<p class="empty">Текст не найден.</p>';
      $('#text-list').querySelectorAll('[data-text]').forEach(input=>input.addEventListener('input',()=>{state.texts[input.dataset.text].text=input.value;changed();}));
    }
    $('#text-search').addEventListener('input',list);$('#section-filter').addEventListener('change',list);list();
    $('#structured-texts').innerHTML=[['audiences','Для кого'],['reasons','Почему с нами удобно'],['steps','Этапы работы']].map(([key,title])=>`<details class="editor-card"><summary>${title}</summary><div class="text-fields">${state[key].map((row,i)=>field('Заголовок '+(i+1),row[0],`data-list="${key}" data-row="${i}" data-col="0"`)+field('Описание '+(i+1),row[1],`data-list="${key}" data-row="${i}" data-col="1"`,true)).join('')}</div></details>`).join('')+`<details class="editor-card"><summary>Клиенты в бегущей строке</summary>${field('Один клиент на строку',state.names.join('\n'),'id="client-names"',true)}</details>`;
    $('#structured-texts').querySelectorAll('[data-list]').forEach(input=>input.addEventListener('input',()=>{state[input.dataset.list][Number(input.dataset.row)][Number(input.dataset.col)]=input.value;changed();}));
    $('#client-names').addEventListener('input',event=>{state.names=event.target.value.split('\n').filter(v=>v.trim());changed();});
  }
  function renderServices(){
    $('#panel').innerHTML='<p class="help">Названия, описания, цены и кнопки семи услуг. Указывайте цену без «от» и знака ₽. Форматы разделяйте символом |.</p>'+state.services.map((row,i)=>`<details class="editor-card" ${i===0?'open':''}><summary>${e(row[0])}</summary><div class="field-grid">${['Название','Цена, ₽','Описание','Форматы через |','Текст кнопки'].map((label,j)=>`<div class="${j===2||j===3?'full':''}">${field(label,row[j],`data-service="${i}" data-col="${j}"`,j===2||j===3)}</div>`).join('')}</div></details>`).join('');
    $('#panel').querySelectorAll('[data-service]').forEach(input=>input.addEventListener('input',()=>{state.services[Number(input.dataset.service)][Number(input.dataset.col)]=input.value;changed();}));
  }
  function renderCases(){
    selectedCase=Math.max(0,Math.min(selectedCase,state.cases.length-1));
    $('#panel').innerHTML=`<p class="help">Добавляйте кейсы и перетаскивайте изображения или видео в область загрузки. Внутри кейса медиа можно менять местами перетаскиванием. Первый файл используется как обложка.</p><div class="case-layout"><div><div class="case-list">${state.cases.map((c,i)=>`<button type="button" data-case="${i}" aria-current="${i===selectedCase}">${e(c.title)}<small>${c.media.length} файлов</small></button>`).join('')}</div><button id="add-case" class="secondary" type="button" style="margin-top:15px;width:100%">+ Добавить кейс</button></div><div id="case-editor" class="case-editor"></div></div>`;
    $('#panel').querySelectorAll('[data-case]').forEach(button=>button.addEventListener('click',()=>{selectedCase=Number(button.dataset.case);renderCases();}));
    $('#add-case').addEventListener('click',()=>{state.cases.push({id:crypto.randomUUID(),title:'Новый кейс',tags:'',description:'',result:'',crop:'',media:[]});selectedCase=state.cases.length-1;changed();renderCases();});
    if(!state.cases.length){$('#case-editor').innerHTML='<p class="empty">Добавьте первый кейс.</p>';return;}
    const c=state.cases[selectedCase];
    $('#case-editor').innerHTML=`<article class="editor-card"><div class="case-toolbar"><h2>${e(c.title)}</h2><div class="actions"><button class="secondary" id="case-up" type="button" ${selectedCase===0?'disabled':''}>Выше</button><button class="secondary" id="case-down" type="button" ${selectedCase===state.cases.length-1?'disabled':''}>Ниже</button><button class="danger" id="delete-case" type="button">Удалить</button></div></div><div class="field-grid">${field('Название',c.title,'data-case-field="title"')}${field('Теги',c.tags,'data-case-field="tags"')}<div class="full">${field('Описание',c.description,'data-case-field="description"',true)}</div><div class="full">${field('Результат',c.result,'data-case-field="result"',true)}</div></div><div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Загрузить фото и видео"><strong>Перетащите фото и видео сюда</strong><span>или выберите файлы. JPG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV.<br>До 95 МБ на файл.</span><input id="media-input" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime" aria-label="Выбрать изображения или видео"></div><div id="upload-status" role="status"></div><div id="media-grid" class="media-grid"></div></article>`;
    $('#case-editor').querySelectorAll('[data-case-field]').forEach(input=>input.addEventListener('input',()=>{c[input.dataset.caseField]=input.value;changed();}));
    $('#delete-case').addEventListener('click',async()=>{if(await confirm('Удалить кейс?',`«${c.title}» исчезнет с сайта после публикации.`)){state.cases.splice(selectedCase,1);changed();renderCases();}});
    for(const [id,offset] of [['case-up',-1],['case-down',1]])$('#'+id).addEventListener('click',()=>{const target=selectedCase+offset;[state.cases[selectedCase],state.cases[target]]=[state.cases[target],state.cases[selectedCase]];selectedCase=target;changed();renderCases();});
    attachMediaDropzone(c);
    renderMedia(c);
  }
  function renderMedia(c){
    const grid=$('#media-grid');if(!grid)return;
    grid.innerHTML=c.media.map((m,i)=>`<article class="media-item" draggable="true" data-media="${i}"><div class="media-preview">${m.type==='image'?`<img src="${e(m.url)}" alt="${e(m.alt)}" loading="lazy">`:`<video src="${e(m.url)}" controls preload="metadata" playsinline></video>`}</div><div class="media-item-body"><p class="media-item-name">${i===0?'Обложка · ':''}${e(m.name)}</p><input value="${e(m.alt)}" data-alt="${i}" placeholder="Описание / подпись" aria-label="Описание медиа"><div class="actions"><button type="button" data-move="${i}" data-direction="-1" ${i===0?'disabled':''}>←</button><button type="button" data-move="${i}" data-direction="1" ${i===c.media.length-1?'disabled':''}>→</button><button type="button" class="remove" data-remove="${i}">Убрать</button></div></div></article>`).join('')||'<p class="empty">Здесь появятся загруженные файлы.</p>';
    grid.querySelectorAll('[data-alt]').forEach(input=>input.addEventListener('input',()=>{c.media[Number(input.dataset.alt)].alt=input.value;changed();}));
    function move(from,to){if(from===to)return;const [item]=c.media.splice(from,1);c.media.splice(to,0,item);changed();renderMedia(c);}
    grid.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>move(Number(button.dataset.move),Number(button.dataset.move)+Number(button.dataset.direction))));
    grid.querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>{c.media.splice(Number(button.dataset.remove),1);changed();renderMedia(c);}));
    let dragged;
    grid.querySelectorAll('[data-media]').forEach(card=>{
      card.addEventListener('dragstart',event=>{if(event.target.closest('input,button,video')){event.preventDefault();return;}dragged=Number(card.dataset.media);card.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(dragged));});
      card.addEventListener('dragend',()=>{dragged=undefined;card.classList.remove('dragging');});
      card.addEventListener('dragover',event=>{if(dragged!==undefined)event.preventDefault();});
      card.addEventListener('drop',event=>{if(dragged===undefined)return;event.preventDefault();move(dragged,Number(card.dataset.media));dragged=undefined;});
    });
  }
  async function uploadFiles(files,c){
    const accepted=new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm','video/quicktime']);
    for(const file of files){
      if(!accepted.has(file.type)||file.size<=0||file.size>95*1024*1024){notice(`«${file.name}»: неподдерживаемый формат или размер больше 95 МБ.`,true);continue;}
      if(c.media.length>=40){notice('В одном кейсе может быть не больше 40 файлов.',true);break;}
      uploads++;status();
      const row=document.createElement('div');row.className='upload-progress';const text=document.createElement('span');text.textContent=file.name;const progress=document.createElement('progress');progress.max=100;progress.value=0;row.append(text,progress);$('#upload-status')?.append(row);
      try{
        const result=await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',api+'/media');xhr.setRequestHeader('Authorization','Bearer '+token);xhr.setRequestHeader('Content-Type',file.type);xhr.timeout=10*60*1000;xhr.upload.onprogress=event=>{if(event.lengthComputable)progress.value=event.loaded/event.total*100;};xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);if(xhr.status<200||xhr.status>=300)reject(Error(data.error||'Ошибка загрузки.'));else resolve(data);}catch{reject(Error('Некорректный ответ сервера.'));}};xhr.onerror=()=>reject(Error('Нет связи с сервером.'));xhr.ontimeout=()=>reject(Error('Загрузка заняла слишком много времени.'));xhr.send(file);});
        c.media.push({...result,name:file.name,alt:''});changed();row.remove();if(state.cases[selectedCase]===c&&['cases','visual'].includes(currentTab))renderMedia(c);
      }catch(error){text.textContent=file.name+': '+error.message;progress.remove();notice(error.message,true);}finally{uploads--;status();}
    }
  }
  function renderSettings(){
    $('#panel').innerHTML=`<p class="help">Заголовок и описание страницы для поисковиков, а также адреса кнопок связи. Видимые подписи контактов редактируются в разделе «Тексты».</p><article class="editor-card"><div class="field-grid">${[['title','Заголовок страницы'],['description','Описание страницы'],['email','Email'],['phone','Телефон с кодом страны'],['telegram','Ссылка Telegram'],['instagram','Ссылка Instagram'],['placeholder_name','Подсказка: имя'],['placeholder_company','Подсказка: компания'],['placeholder_contact','Подсказка: контакт'],['placeholder_task','Подсказка: задача'],['placeholder_deadline','Подсказка: срок']].map(([key,label])=>field(label,state.settings[key],`data-setting="${key}"`,key==='description')).join('')}</div></article>`;
    $('#panel').querySelectorAll('[data-setting]').forEach(input=>input.addEventListener('input',()=>{state.settings[input.dataset.setting]=input.value;changed();}));
  }
  $('#publish').addEventListener('click',async()=>{
    if(uploads||!dirty)return;if(!await confirm(local?'Применить изменения локально?':'Опубликовать изменения?',local?'Изменится только локальный лендинг на этом компьютере.':'Новые тексты и кейсы станут видны всем посетителям сайта.'))return;
    const button=$('#publish');button.disabled=true;
    try{const saved=await request('/content',{method:'PUT',body:JSON.stringify({revision,content:state})});revision=saved.revision;dirty=false;clearTimeout(draftTimer);localStorage.removeItem('neir-content-draft');$('#draft-banner').hidden=true;notice(local?'Изменения сохранены локально. Обновите лендинг, чтобы увидеть результат.':'Изменения опубликованы. Обновите лендинг, чтобы увидеть результат.');}catch(error){notice(error.message,true);}finally{status();}
  });
  $('#preview').addEventListener('click',()=>{
    try{sessionStorage.setItem('neir-preview',JSON.stringify(state));const url=new URL('../',location.href);url.searchParams.set('cms-preview','1');url.searchParams.set('v',Date.now());$('#preview-frame').src=url.href;$('#preview-dialog').showModal();}catch{notice('Не удалось подготовить предпросмотр.',true);}
  });
  $('#close-preview').addEventListener('click',()=>{$('#preview-dialog').close();$('#preview-frame').src='about:blank';});
  $('#preview-dialog').addEventListener('cancel',()=>{$('#preview-frame').src='about:blank';});
  $('#export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='neir-content-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('#restore-draft').addEventListener('click',()=>{try{const draft=JSON.parse(localStorage.getItem('neir-content-draft'));if(draft.revision!==revision){notice('Черновик относится к старой версии сайта. Скачайте копию и проверьте изменения перед публикацией.',true);revision=draft.revision;}state=draft.content;changed();$('#draft-banner').hidden=true;render();}catch{notice('Не удалось восстановить черновик.',true);}});
  $('#discard-draft').addEventListener('click',()=>{localStorage.removeItem('neir-content-draft');$('#draft-banner').hidden=true;});
  $('#logout').addEventListener('click',async()=>{if(uploads){notice('Дождитесь завершения загрузок.',true);return;}try{await request('/logout',{method:'POST'});}catch{}token='';sessionStorage.removeItem('neir-admin-session');$('#workspace').hidden=true;$('#login-screen').hidden=false;if(editorFrame())editorFrame().src='about:blank';});
  addEventListener('beforeunload',event=>{if(dirty||uploads){event.preventDefault();event.returnValue='';}});
  if(token&&api)start().catch(error=>{$('#login-status').textContent=error.message;});
  if(!api)$('#login-status').textContent='Сервис админки ещё не подключён.';
})();
