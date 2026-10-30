(async () => {
  const preview = new URLSearchParams(location.search).has('cms-preview');
  let saved;
  if (preview) {
    try { saved = JSON.parse(sessionStorage.getItem('neir-preview') || 'null'); } catch {}
  } else if (window.NEIR_API_URL) {
    try {
      const response = await fetch(window.NEIR_API_URL + '/content', {cache:'no-store', signal:AbortSignal.timeout(4500)});
      if (response.ok) saved = (await response.json()).content;
    } catch { /* Keep the embedded version available when the content API is offline. */ }
  }
  window.NEIR_CONTENT = {...window.NEIR_DEFAULTS, ...saved};
  const settings = window.NEIR_CONTENT.settings || {};
  for (const key of ['email','phone','telegram','instagram']) if (settings[key] !== undefined) window.NEIR_CONFIG[key] = settings[key];
  function load(src) {
    return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});
  }
  const hero = document.querySelector('.hero-video');
  if (window.NEIR_MEDIA_BASE.startsWith('https://') && hero && !hero.src.startsWith(window.NEIR_MEDIA_BASE)) { hero.src=window.NEIR_MEDIA_BASE+'video-4.mp4'; hero.load(); }
  await load('app.js');
  const texts = window.NEIR_CONTENT.texts || {};
  document.querySelectorAll('[data-cms-text]').forEach(el=>{
    const value = texts[el.dataset.cmsText];
    if (value !== undefined) el.textContent = typeof value === 'string' ? value : value.text;
  });
  for (const name of ['name','company','contact','task','deadline']) { const input=document.querySelector(`#brief [name="${name}"]`); if(input && settings['placeholder_'+name]!==undefined)input.placeholder=settings['placeholder_'+name]; }
  if (settings.title) document.title = settings.title;
  if (settings.description) document.querySelector('meta[name="description"]').content = settings.description;
  document.querySelectorAll('a[href^="mailto:"]').forEach(a=>{a.href='mailto:'+window.NEIR_CONFIG.email;});
  document.querySelectorAll('a[href^="tel:"]').forEach(a=>{a.href='tel:'+window.NEIR_CONFIG.phone;});
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>{a.href='https://wa.me/'+window.NEIR_CONFIG.phone.replace(/\D/g,'');});
  await load('interactions.js');
  if(preview && new URLSearchParams(location.search).has('cms-editor') && parent!==window)await load('visual-editor.js');
})();
