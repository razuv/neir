(() => {
  if (parent === window || !new URLSearchParams(location.search).has('cms-editor')) return;
  const allowedOrigin = location.origin;
  const content = window.NEIR_CONTENT;
  const bindings = [];
  let editMode = true;
  let selected;
  function send(type, extra = {}) { parent.postMessage({type:'neir-editor:' + type, ...extra}, allowedOrigin); }
  function valueOf(ref) {
    if (ref.kind === 'text') return content.texts[ref.key]?.text || '';
    if (ref.kind === 'service') return content.services[ref.index]?.[ref.column] || '';
    if (ref.kind === 'list') return content[ref.list]?.[ref.index]?.[ref.column] || '';
    if (ref.kind === 'name') return content.names[ref.index] || '';
    if (ref.kind === 'case') return content.cases.find(c => c.id === ref.id)?.[ref.field] || '';
    return '';
  }
  function assign(ref, value) {
    if (ref.kind === 'text') content.texts[ref.key].text = value;
    if (ref.kind === 'service') content.services[ref.index][ref.column] = value;
    if (ref.kind === 'list') content[ref.list][ref.index][ref.column] = value;
    if (ref.kind === 'name') content.names[ref.index] = value;
    if (ref.kind === 'case' && ref.field) content.cases.find(c => c.id === ref.id)[ref.field] = value;
  }
  function bind(element, ref, inline = true) {
    if (!element) return;
    const binding = {element, ref, inline};
    element.dataset.editorBinding = String(bindings.push(binding) - 1);
    if (inline) {
      element.setAttribute('contenteditable', 'plaintext-only');
      element.setAttribute('spellcheck', 'true');
      element.addEventListener('focus', () => { selected=binding; highlight(binding); send('select', {ref}); });
      element.addEventListener('input', () => {
        let value = element.innerText.replace(/\r/g, '');
        if (ref.kind==='service' && ref.column===1) value=value.replace(/^от\s*/i,'').replace(/\s*₽\s*$/,'');
        value=value.slice(0,10000);
        assign(ref,value); send('change',{ref,value});
      });
      element.addEventListener('keydown', event => {
        if (event.key==='Escape') { event.preventDefault(); element.blur(); }
        if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s') { event.preventDefault(); element.blur(); send('save'); }
      });
      element.addEventListener('blur', () => renderBinding(binding));
    }
  }
  document.querySelectorAll('[data-cms-text]').forEach(el => bind(el,{kind:'text',key:el.dataset.cmsText}));
  document.querySelectorAll('.service').forEach((service,index) => {
    const ref = column => ({kind:'service',index,column});
    bind(service.querySelector('summary h2'),ref(0));
    service.querySelectorAll('.price').forEach(el=>bind(el,ref(1)));
    bind(service.querySelector('.service-copy > p'),ref(2));
    bind(service.querySelector('.tags'),ref(3),false);
    const button=service.querySelector('.service-copy .button');
    const label=document.createElement('span');
    const node=[...button.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
    if(node){label.textContent=node.textContent.trim();node.replaceWith(label);bind(label,ref(4));}
  });
  for(const list of ['audiences','reasons','steps']) {
    const selector=list==='steps'?'.step':list==='reasons'?'.reason':'article';
    document.querySelectorAll('#'+list+' '+selector).forEach((article,index)=>{
      bind(article.querySelector('h3'),{kind:'list',list,index,column:0});
      bind(article.querySelector('p'),{kind:'list',list,index,column:1});
    });
  }
  document.querySelectorAll('.marquee > span').forEach((el,index)=>bind(el,{kind:'name',index:index%content.names.length}));
  document.querySelectorAll('.case-card').forEach((card,index)=>{
    const c=content.cases[index];if(!c)return;
    card.dataset.editorCase=c.id;
    bind(card.querySelector('.case-preview'),{kind:'case',id:c.id},false);
    bind(card.querySelector('h3'),{kind:'case',id:c.id,field:'title'});
    bind(card.querySelector('p'),{kind:'case',id:c.id,field:'tags'});
    card.addEventListener('dragover',event=>{if(!editMode||!event.dataTransfer.types.includes('Files'))return;event.preventDefault();card.classList.add('cms-drop-target');});
    card.addEventListener('dragleave',()=>card.classList.remove('cms-drop-target'));
    card.addEventListener('drop',event=>{if(!editMode)return;event.preventDefault();card.classList.remove('cms-drop-target');const files=[...event.dataTransfer.files];if(files.length)send('files',{id:c.id,files});});
  });
  function highlight(binding) {
    document.querySelectorAll('.cms-selected').forEach(el=>el.classList.remove('cms-selected'));
    binding?.element.classList.add('cms-selected');
  }
  function renderBinding(binding) {
    const {element,ref}=binding;
    if(!binding.inline||element===document.activeElement)return;
    const value=valueOf(ref);
    const display=ref.kind==='service'&&ref.column===1?'от '+value+' ₽':value;
    if(element.textContent!==display)element.textContent=display;
  }
  function sync(next) {
    for(const key of Object.keys(next)) {
      if(key==='cases')next.cases.forEach(c=>{const old=content.cases.find(item=>item.id===c.id);if(old)Object.assign(old,c);});
      else content[key]=next[key];
    }
    bindings.forEach(renderBinding);
    document.querySelectorAll('.service .tags').forEach((tags,index)=>{
      const formats=content.services[index][3].split('|');
      if(tags.textContent!==formats.join(''))tags.replaceChildren(...formats.map(format=>{const span=document.createElement('span');span.textContent=format;return span;}));
    });
  }
  document.addEventListener('click',event=>{
    if(!editMode)return;
    const bound=event.target.closest('[data-editor-binding]');
    if(bound){
      event.stopImmediatePropagation();
      if(bound.closest('a,button,summary'))event.preventDefault();
      selected=bindings[Number(bound.dataset.editorBinding)];highlight(selected);send('select',{ref:selected.ref});
      if(selected.inline){bound.focus({preventScroll:true});if(bound.closest('a,button,summary')&&document.caretRangeFromPoint){const range=document.caretRangeFromPoint(event.clientX,event.clientY);if(range&&bound.contains(range.startContainer)){const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}}}
      return;
    }
    // Keep accordions and video controls functional; prevent leaving the editor or sending a form.
    const link=event.target.closest('a');
    if(link){event.preventDefault();event.stopImmediatePropagation();if(link.hash)document.querySelector(link.hash)?.scrollIntoView({behavior:'smooth'});}
  },true);
  document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==allowedOrigin)return;
    const message=event.data;
    if(message?.type==='neir-editor:sync'&&message.content)sync(message.content);
    if(message?.type==='neir-editor:mode'){
      editMode=Boolean(message.edit);document.documentElement.classList.toggle('cms-edit-mode',editMode);
      bindings.filter(b=>b.inline).forEach(b=>b.element.setAttribute('contenteditable',editMode?'plaintext-only':'false'));
      if(!editMode)highlight(null);
    }
    if(message?.type==='neir-editor:scroll'&&typeof message.id==='string'){
      document.getElementById(message.id)?.scrollIntoView({behavior:'smooth',block:'start'});
    }
    if(message?.type==='neir-editor:position'&&Number.isFinite(message.y))scrollTo({top:message.y,behavior:'instant'});
  });
  const style=document.createElement('style');
  style.textContent=`html.cms-edit-mode [data-editor-binding]{cursor:text;outline-offset:4px;transition:outline-color .12s}html.cms-edit-mode [data-editor-binding]:hover{outline:1px dashed #7caaff}html.cms-edit-mode [data-editor-binding].cms-selected{outline:2px solid #0057ff}html.cms-edit-mode [contenteditable]:focus{outline:2px solid #0057ff}html.cms-edit-mode [contenteditable]{white-space:pre-wrap;min-width:1ch}html.cms-edit-mode .case-preview{cursor:pointer}html.cms-edit-mode .case-card{display:block!important}html.cms-edit-mode .all-cases{display:none}html.cms-edit-mode .marquee{animation-play-state:paused}html.cms-edit-mode .parallax-heading{translate:none!important}html.cms-edit-mode .cms-drop-target{outline:3px solid #0057ff;outline-offset:6px}html.cms-edit-mode .case-preview:hover{transform:none}html.cms-edit-mode .hero h1 [contenteditable]{line-height:inherit}`;
  document.head.append(style);document.documentElement.classList.add('cms-edit-mode');
  send('ready');
})();
