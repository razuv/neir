(() => {
  const photos = [
    {key: 'samokat', caption: 'Самокат — event-фотосъёмка'},
    {key: 'event', caption: 'Арх Москва — фотосъёмка выставки'},
  ];
  // Shared photo collection uses the actual two photographs supplied in the mockup.
  document.querySelectorAll('.service.landscape .service-media').forEach((gallery, galleryIndex) => {
    gallery.classList.add('photo-gallery');
    gallery.setAttribute('role', 'region');
    gallery.setAttribute('aria-label', 'Фотогалерея проектов NEIR MEDIA');
    let current = galleryIndex % photos.length;
    gallery.innerHTML = `<div class="photo-slides">${photos.map((photo, i) => `<figure class="photo-slide" ${i !== current ? 'hidden' : ''}>${art(photo.key, 'wide', photo.caption)}<figcaption>${photo.caption}</figcaption></figure>`).join('')}</div><div class="gallery-control" aria-label="Выбор фотографии">${photos.map((photo, i) => `<button type="button" aria-label="${photo.caption}" aria-pressed="${i === current}" data-photo="${i}"></button>`).join('')}</div><span class="sr-only photo-status" aria-live="polite"></span>`;
    const select = index => {
      current = (index + photos.length) % photos.length;
      gallery.dataset.index = current;
      gallery.querySelectorAll('.photo-slide').forEach((slide, i) => slide.hidden = i !== current);
      gallery.querySelectorAll('[data-photo]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
      gallery.querySelector('.photo-status').textContent = `${current + 1} из ${photos.length}. ${photos[current].caption}`;
    };
    gallery.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => select(Number(button.dataset.photo))));
    gallery.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      select(current + (event.key === 'ArrowRight' ? 1 : -1));
      gallery.querySelectorAll('[data-photo]')[current].focus();
    });
    let touchStart;
    gallery.addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, {passive: true});
    gallery.addEventListener('touchend', event => {
      const delta = event.changedTouches[0].clientX - touchStart;
      if (Math.abs(delta) > 45) select(current + (delta < 0 ? 1 : -1));
    }, {passive: true});
    select(current);
  });

  const videos = ['video-1.mp4', 'video-2.mp4', 'video-3.mov', 'video-5.mp4', 'video-6.mp4', 'video-7.mp4'];
  const players = [];
  function createCarousel(container, start = 0) {
    container.classList.add('reel-carousel');
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Видеокарусель NEIR MEDIA');
    container.innerHTML = `<div class="reel-track"><button type="button" class="reel-side reel-previous" aria-label="Предыдущее видео"><video muted playsinline preload="metadata" aria-hidden="true"></video><span class="sr-only">Предыдущее видео</span></button><div class="reel-active"><video muted playsinline preload="auto" aria-label="Видео NEIR MEDIA"></video><button type="button" class="reel-playback" aria-label="Приостановить видео"><span aria-hidden="true">Ⅱ</span></button><button type="button" class="reel-sound" aria-label="Включить звук">Звук выкл.</button><span class="reel-count" aria-live="off"></span><p class="reel-error" hidden>Не удалось воспроизвести видео. Выберите соседний ролик.</p></div><button type="button" class="reel-side reel-next" aria-label="Следующее видео"><video muted playsinline preload="metadata" aria-hidden="true"></video><span class="sr-only">Следующее видео</span></button></div>`;
    let active = container.querySelector('.reel-active video');
    let previous = container.querySelector('.reel-previous video');
    let next = container.querySelector('.reel-next video');
    const playback = container.querySelector('.reel-playback');
    const sound = container.querySelector('.reel-sound');
    const parentDetails = container.closest('details');
    let index = start % videos.length;
    let visible = false;
    let userPaused = false;
    const allowed = () => visible && !document.hidden && (!parentDetails || parentDetails.open);
    const sync = () => {
      if (!allowed() || userPaused) { active.pause(); return; }
      active.play().catch(() => { if (active.paused) updatePlayback(); });
    };
    const updatePlayback = () => {
      playback.setAttribute('aria-label', active.paused ? 'Воспроизвести видео' : 'Приостановить видео');
      playback.firstElementChild.textContent = active.paused ? '▶' : 'Ⅱ';
    };
    const videoCache = new Map();
    const getVideo = item => {
      const key = (item + videos.length) % videos.length;
      if (!videoCache.has(key)) {
        const video = document.createElement('video');
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.dataset.source = window.NEIR_MEDIA_BASE + videos[key];
        video.addEventListener('ended', () => { if (video === active) select(index + 1); });
        video.addEventListener('play', () => { if (video === active) updatePlayback(); });
        video.addEventListener('pause', () => { if (video === active) updatePlayback(); });
        video.addEventListener('error', () => { if (video === active) container.querySelector('.reel-error').hidden = false; });
        video.addEventListener('loadeddata', () => { if (video === active) sync(); });
        video.addEventListener('click', () => { if (video === active) togglePlay(); });
        videoCache.set(key, video);
      }
      const video = videoCache.get(key);
      if (visible && !video.hasAttribute('src')) video.src = video.dataset.source;
      return video;
    };
    const slots = [...container.querySelectorAll('.reel-previous, .reel-active, .reel-next')];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let slotAnimations = [];
    const stopMotion = () => {
      slotAnimations.forEach(animation => animation.cancel());
      slotAnimations = [];
    };
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopMotion(); });
    const select = target => {
      const direction = target < index ? -1 : 1;
      const origins = new Map(slots.map(slot => [slot.querySelector('video')?.dataset.source, slot.getBoundingClientRect()]));
      const shouldAnimate = visible && active.hasAttribute('src') && !reducedMotion.matches;
      stopMotion();
      active.pause();
      active.muted = true;
      index = (target + videos.length) % videos.length;
      userPaused = false;
      container.dataset.index = index;
      container.querySelector('.reel-error').hidden = true;
      // Move the already loaded neighboring players instead of replacing their source.
      previous.remove(); active.remove(); next.remove();
      previous = getVideo(index - 1);
      active = getVideo(index);
      next = getVideo(index + 1);
      previous.pause(); next.pause();
      previous.muted = true; next.muted = true; active.muted = true;
      previous.setAttribute('aria-hidden', 'true');
      next.setAttribute('aria-hidden', 'true');
      active.removeAttribute('aria-hidden');
      active.setAttribute('aria-label', 'Видео NEIR MEDIA');
      container.querySelector('.reel-previous').prepend(previous);
      container.querySelector('.reel-active').prepend(active);
      container.querySelector('.reel-next').prepend(next);
      if (active.readyState >= 1) active.currentTime = 0;
      sound.textContent = 'Звук выкл.';
      sound.setAttribute('aria-label', 'Включить звук');
      container.querySelector('.reel-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(videos.length).padStart(2, '0')}`;
      if (shouldAnimate) {
        // FLIP: move each source from its previous slot into its new position and size.
        slots.forEach(slot => {
          const destination = slot.getBoundingClientRect();
          if (!destination.width || !destination.height) return;
          const origin = origins.get(slot.querySelector('video').dataset.source);
          const x = origin ? origin.left - destination.left : direction * (destination.width + 18);
          const y = origin ? origin.top - destination.top : 0;
          const sx = origin ? origin.width / destination.width : .92;
          const sy = origin ? origin.height / destination.height : .92;
          slotAnimations.push(slot.animate([
            {transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})`},
            {transform: 'translate(0, 0) scale(1, 1)'}
          ], {duration: 460, easing: 'cubic-bezier(.22,.75,.25,1)'}));
        });
      }
      sync();
    };
    const loadPending = () => [previous, active, next].forEach(video => {
      if (video.getAttribute('src') !== video.dataset.source) { video.src = video.dataset.source; video.load(); }
    });
    container.querySelector('.reel-previous').addEventListener('click', () => select(index - 1));
    container.querySelector('.reel-next').addEventListener('click', () => select(index + 1));
    function togglePlay() { userPaused = !active.paused; sync(); }
    playback.addEventListener('click', togglePlay);
    sound.addEventListener('click', () => {
      active.muted = !active.muted;
      if (!active.muted) players.forEach(player => { if (player.video !== active) player.mute(); });
      sound.textContent = active.muted ? 'Звук выкл.' : 'Звук вкл.';
      sound.setAttribute('aria-label', active.muted ? 'Включить звук' : 'Выключить звук');
    });
    const mute = () => { active.muted = true; sound.textContent = 'Звук выкл.'; sound.setAttribute('aria-label', 'Включить звук'); };
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) loadPending();
      else mute();
      sync();
    }, {threshold: .25});
    observer.observe(container);
    parentDetails?.addEventListener('toggle', sync);
    document.addEventListener('visibilitychange', sync);
    container.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      select(index + (event.key === 'ArrowRight' ? 1 : -1));
    });
    let touchStart;
    container.addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, {passive: true});
    container.addEventListener('touchend', event => {
      const delta = event.changedTouches[0].clientX - touchStart;
      if (Math.abs(delta) > 45) select(index + (delta < 0 ? 1 : -1));
    }, {passive: true});
    players.push({get video() { return active; }, mute});
    select(index);
  }
  document.querySelectorAll('.service:not(.landscape) .service-media').forEach((container, i) => createCarousel(container, i));
  document.querySelectorAll('.offer-art').forEach((container, i) => createCarousel(container, i + 3));
  // The full story collection is initialized separately below.

  const hero = document.querySelector('.hero-video');
  const heroSection = document.querySelector('.hero');
  hero.muted = true;
  hero.defaultMuted = true;
  hero.autoplay = true;
  hero.playsInline = true;
  hero.loop = true;
  let heroVisible = heroSection.getBoundingClientRect().bottom > 0;
  let heroStarting = false;
  function syncHero() {
    if (!heroVisible || document.hidden) { hero.pause(); return; }
    if (heroStarting || !hero.paused) return;
    hero.muted = true;
    heroStarting = true;
    hero.play().catch(() => {}).finally(() => { heroStarting = false; });
  }
  new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    syncHero();
  }).observe(heroSection);
  ['loadeddata', 'canplay', 'pause'].forEach(event => hero.addEventListener(event, syncHero));
  document.addEventListener('visibilitychange', syncHero);
  window.addEventListener('pageshow', syncHero);
  window.addEventListener('focus', syncHero);
  // Retry after a visitor gesture when browser autoplay policy initially blocks play().
  document.addEventListener('pointerdown', syncHero, {passive: true});
  document.addEventListener('keydown', syncHero);
  syncHero();

  const select = document.querySelector('.budget-select');
  const trigger = document.querySelector('#budget-trigger');
  const list = document.querySelector('#budget-options');
  const input = select.querySelector('input');
  const label = document.querySelector('#budget-value');
  const values = ['Пока не знаю', 'До 100 000 ₽', '100 000–250 000 ₽', '250 000–500 000 ₽', '500 000–1 000 000 ₽', '1 000 000 ₽+'];
  let chosen = 0;
  let focused = 0;
  list.innerHTML = values.map((value, i) => `<li id="budget-option-${i}" role="option" aria-selected="${i === chosen}" data-value="${i}">${value}<i class="corner-icon" aria-hidden="true"></i></li>`).join('');
  const options = [...list.children];
  function focusOption(index) {
    focused = (index + values.length) % values.length;
    trigger.setAttribute('aria-activedescendant', options[focused].id);
    options.forEach((option, i) => option.classList.toggle('is-focused', i === focused));
    options[focused].scrollIntoView({block: 'nearest'});
  }
  function close() {
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
  }
  function open() {
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    focusOption(chosen);
  }
  function choose(index) {
    chosen = index;
    input.value = values[index];
    label.textContent = values[index];
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    close();
    trigger.focus({preventScroll: true});
  }
  trigger.addEventListener('click', () => list.hidden ? open() : close());
  list.addEventListener('pointerdown', event => event.preventDefault());
  list.addEventListener('click', event => {
    const option = event.target.closest('[data-value]');
    if (option) choose(Number(option.dataset.value));
  });
  trigger.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); return; }
    if (event.key === 'Tab') { close(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (list.hidden) open();
      else focusOption(event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : focused + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (list.hidden) open(); else choose(focused);
    }
  });
  document.addEventListener('click', event => { if (!select.contains(event.target)) close(); });
  select.addEventListener('focusout', event => { if (!select.contains(event.relatedTarget)) close(); });
  document.querySelector('#brief').addEventListener('reset', () => {
    chosen = 0;
    input.value = values[0];
    label.textContent = values[0];
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === 0)));
    close();
  });
})();

// A small cursor offset adds depth without changing layout or touch scrolling.
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const headings = [...document.querySelectorAll('.hero h1, .hero h2, .hero h3')];
  const visible = new Set();
  headings.forEach(heading => heading.classList.add('parallax-heading'));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) visible.add(entry.target);
    else { visible.delete(entry.target); entry.target.style.removeProperty('translate'); }
  }));
  headings.forEach(heading => observer.observe(heading));
  let frame = 0;
  let cursor = {x: 0, y: 0};
  function reset() { headings.forEach(heading => heading.style.removeProperty('translate')); }
  document.addEventListener('pointermove', event => {
    if (motion.matches || !pointer.matches || event.pointerType === 'touch') return;
    cursor = {x: event.clientX, y: event.clientY};
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      visible.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        const strength = heading.tagName === 'H1' ? 7 : heading.tagName === 'H2' ? 4 : 2;
        const x = Math.max(-1, Math.min(1, (cursor.x - rect.left - rect.width / 2) / (innerWidth / 2)));
        const y = Math.max(-1, Math.min(1, (cursor.y - rect.top - rect.height / 2) / (innerHeight / 2)));
        heading.style.translate = `${(x * strength).toFixed(2)}px ${(y * strength).toFixed(2)}px`;
      });
    });
  }, {passive: true});
  document.documentElement.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
  motion.addEventListener('change', reset);
  pointer.addEventListener('change', reset);
})();

// Full, scrollable collection: every film has its own card, only the selected film plays.
(() => {
  const gallery = document.querySelector('#video-gallery');
  const files = ['video-1.mp4','video-2.mp4','video-3.mov','video-5.mp4','video-6.mp4','video-7.mp4'];
  gallery.className = 'stories-carousel';
  gallery.setAttribute('role', 'region');
  gallery.setAttribute('aria-label', 'Видео и визуальные истории');
  gallery.innerHTML = `<div class="stories-track" tabindex="0" aria-label="Карусель видео. Используйте стрелки влево и вправо">${files.map((file,i)=>`<article class="story-card" data-story="${i}"><div class="story-stage"><video data-src="${window.NEIR_MEDIA_BASE}${file}" muted playsinline preload="metadata" aria-label="Визуальная история ${i+1}"></video><button type="button" class="story-select" aria-label="Выбрать видео ${i+1}" aria-pressed="false"><span class="play-icon" aria-hidden="true">▶</span></button><div class="story-controls"><button type="button" class="story-play" aria-label="Приостановить видео">Ⅱ</button><button type="button" class="story-sound">Звук выкл.</button></div><p class="story-error" hidden>Не удалось загрузить видео. <a href="${window.NEIR_MEDIA_BASE}${file}" target="_blank" rel="noopener">Открыть ролик</a></p></div><p class="story-label">NEIR MEDIA / ${String(i+1).padStart(2,'0')}</p></article>`).join('')}</div><div class="stories-nav"><button type="button" class="stories-prev" aria-label="Предыдущее видео"><i class="corner-icon" aria-hidden="true"></i></button><span class="stories-status" aria-live="polite">01 / 06</span><button type="button" class="stories-next" aria-label="Следующее видео"><i class="corner-icon" aria-hidden="true"></i></button></div>`;
  const track = gallery.querySelector('.stories-track');
  const cards = [...gallery.querySelectorAll('.story-card')];
  const media = cards.map(card=>card.querySelector('video'));
  let selected = 0, visible = false, paused = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let rebalanceTimer;
  function rebalance() {
    if (manuallyScrolling) return;
    const offset = cards[selected].offsetLeft - track.scrollLeft;
    track.classList.add('is-rebalancing');
    for (let step = -2; step < cards.length - 2; step++) {
      track.append(cards[(selected + step + cards.length) % cards.length]);
    }
    track.scrollTo({left: cards[selected].offsetLeft - offset, behavior: 'instant'});
    requestAnimationFrame(() => track.classList.remove('is-rebalancing'));
    sync();
  }
  function sync() {
    media.forEach((video,i)=>{
      if(i!==selected || !visible || document.hidden || paused) video.pause();
      else video.play().catch(()=>{});
    });
  }
  function choose(index, scroll=true) {
    if(scroll)manuallyScrolling=false;
    clearTimeout(rebalanceTimer);
    const target=(index+cards.length)%cards.length;
    if (scroll && target !== selected) {
      const forward = index > selected;
      if (forward && cards[target].offsetLeft < cards[selected].offsetLeft) track.append(cards[target]);
      if (!forward && cards[target].offsetLeft > cards[selected].offsetLeft) {
        const before = cards[selected].offsetLeft;
        track.prepend(cards[target]);
        track.scrollTo({left:track.scrollLeft + cards[selected].offsetLeft - before,behavior:'instant'});
      }
    }
    selected=target;
    paused=false;
    gallery.dataset.index=String(selected);
    cards.forEach((card,i)=>{
      card.classList.toggle('is-selected',i===selected);
      card.querySelector('.story-select').setAttribute('aria-pressed',String(i===selected));
      if(i!==selected){media[i].muted=true;card.querySelector('.story-sound').textContent='Звук выкл.';}
    });
    gallery.querySelector('.stories-status').textContent=`${String(selected+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
    if(scroll) track.scrollTo({left:cards[selected].offsetLeft-track.offsetLeft-(track.clientWidth-cards[selected].offsetWidth)/2,behavior:reduced.matches?'instant':'smooth'});
    rebalanceTimer=setTimeout(rebalance,700);
    sync();
  }
  cards.forEach((card,i)=>{
    const video=media[i];
    card.querySelector('.story-select').addEventListener('click',()=>choose(i));
    const play=card.querySelector('.story-play');
    const toggle=()=>{paused=!video.paused;sync();};
    play.addEventListener('click',toggle);
    video.addEventListener('click',toggle);
    const update=()=>{play.textContent=video.paused?'▶':'Ⅱ';play.setAttribute('aria-label',video.paused?'Воспроизвести видео':'Приостановить видео');};
    video.addEventListener('play',update);video.addEventListener('pause',update);
    video.addEventListener('loadeddata',sync);
    video.addEventListener('ended',()=>{if(i===selected)choose(i+1);});
    video.addEventListener('error',()=>card.querySelector('.story-error').hidden=false);
    card.querySelector('.story-sound').addEventListener('click',()=>{
      video.muted=!video.muted;
      card.querySelector('.story-sound').textContent=video.muted?'Звук выкл.':'Звук вкл.';
    });
  });
  gallery.querySelector('.stories-prev').addEventListener('click',()=>choose(selected-1));
  gallery.querySelector('.stories-next').addEventListener('click',()=>choose(selected+1));
  track.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();choose(event.key==='Home'?0:event.key==='End'?cards.length-1:selected+(event.key==='ArrowRight'?1:-1));
  });
  let manuallyScrolling=false;
  track.addEventListener('pointerdown',()=>manuallyScrolling=true);
  track.addEventListener('wheel',()=>manuallyScrolling=true,{passive:true});
  let timer;
  track.addEventListener('scroll',()=>{
    if(!manuallyScrolling)return;
    clearTimeout(timer);timer=setTimeout(()=>{
      manuallyScrolling=false;
      const center=track.scrollLeft+track.clientWidth/2;
      const nearest=cards.reduce((best,card,i)=>Math.abs(card.offsetLeft-track.offsetLeft+card.offsetWidth/2-center)<Math.abs(cards[best].offsetLeft-track.offsetLeft+cards[best].offsetWidth/2-center)?i:best,0);
      choose(nearest,false);
    },160);
  },{passive:true});
  new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(visible)media.forEach(video=>{if(!video.getAttribute('src')){video.src=video.dataset.src;video.load();}});
    sync();
  },{threshold:.2}).observe(gallery);
  document.addEventListener('visibilitychange',sync);
  choose(0,false);
  rebalance();
  track.scrollTo({left:cards[0].offsetLeft-track.offsetLeft-(track.clientWidth-cards[0].offsetWidth)/2,behavior:'instant'});
})();

// Keep short Russian prepositions/conjunctions attached to the next word,
// including dynamically opened case descriptions; never alter form values.
(() => {
  const pattern=/(^|[\s(«])((?:в|во|на|к|ко|с|со|у|о|об|обо|от|до|из|за|по|под|над|при|про|для|без|через|перед|между|и|а|но|не|ни|или|из-за|из-под))[ \t]+/gimu;
  function apply(root){
    if (!(root instanceof Node)) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      return node.parentElement?.closest('script,style,textarea,input,select,option,[contenteditable],#budget-options,#budget-value')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }});
    let node;
    while((node=walker.nextNode())){
      const original=node.nodeValue;
      let next=original;
      for(let i=0;i<2;i++)next=next.replace(pattern,'$1$2\u00a0');
      if(next!==original)node.nodeValue=next;
    }
  }
  apply(document.body);
  new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='characterData')apply(record.target.parentElement);
      else for(const node of record.addedNodes)if(node.nodeType===1)apply(node);else if(node.nodeType===3)apply(node.parentElement);
    }
  }).observe(document.body,{childList:true,subtree:true,characterData:true});
})();

// Animate a dedicated content panel; never toggle native open just to measure height.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('details.service, details.offer-details').forEach(details => {
    const summary = details.querySelector(':scope > summary');
    if (!summary) return;
    const panel = document.createElement('div');
    panel.className = 'disclosure-panel';
    const content = document.createElement('div');
    content.className = 'disclosure-content';
    [...details.children].filter(child => child !== summary).forEach(child => content.append(child));
    panel.append(content);
    details.append(panel);
    let intended = details.open;
    let running = false;
    let revision = 0;
    let animations = [];
    function finish() {
      details.open = intended;
      panel.inert = !intended;
      panel.style.height = intended ? 'auto' : '0px';
      content.style.opacity = intended ? '1' : '0';
      details.classList.remove('is-animating', 'is-expanding', 'is-collapsing', 'disclosure-shrinking');
      running = false;
    }
    finish();
    async function animate(element, keyframes, duration, id) {
      const animation = element.animate(keyframes, {duration, easing: 'cubic-bezier(.22,.7,.25,1)', fill: 'forwards'});
      animations.push(animation);
      await animation.finished.catch(() => {});
      return id === revision;
    }
    async function change() {
      const id = ++revision;
      const height = panel.getBoundingClientRect().height;
      const opacity = details.open ? Number(getComputedStyle(content).opacity) : 0;
      intended = running ? !intended : !details.open;
      animations.forEach(animation => animation.cancel());
      animations = [];
      panel.style.height = `${height}px`;
      content.style.opacity = String(opacity);
      details.classList.remove('is-expanding', 'is-collapsing', 'disclosure-shrinking');
      if (reduced.matches) { finish(); return; }
      running = true;
      panel.inert = true;
      details.classList.add('is-animating', intended ? 'is-expanding' : 'is-collapsing');
      details.open = true;
      // Hide content before resizing; it cannot flash through the opening clip.
      if (opacity > 0) {
        if (!await animate(content, [{opacity}, {opacity: 0}], 130, id)) return;
      }
      content.style.opacity = '0';
      const destination = intended ? content.getBoundingClientRect().height : 0;
      if (!intended) details.classList.add('disclosure-shrinking');
      if (!await animate(panel, [{height: `${height}px`}, {height: `${destination}px`}], 340, id)) return;
      panel.style.height = `${destination}px`;
      if (intended) {
        if (!await animate(content, [{opacity: 0}, {opacity: 1}], 180, id)) return;
      }
      animations.forEach(animation => animation.cancel());
      animations = [];
      finish();
    }
    summary.addEventListener('click', event => {
      if (event.target.closest('a,input,button')) return;
      event.preventDefault();
      change();
    });
    function settle() {
      if (!running) return;
      revision++;
      animations.forEach(animation => animation.cancel());
      animations = [];
      finish();
    }
    reduced.addEventListener('change', () => { if (reduced.matches) settle(); });
    window.addEventListener('resize', settle);
  });
})();
