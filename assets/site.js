// ---------- footer year ----------
document.querySelectorAll('#year').forEach(el => el.textContent = new Date().getFullYear());

// ---------- mobile menu ----------
const burger = document.getElementById('burger');
const mmenu = document.getElementById('mmenu');
if (burger && mmenu) {
  burger.addEventListener('click', () => mmenu.classList.toggle('open'));
  mmenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mmenu.classList.remove('open')));
}

// ---------- active nav link ----------
(function markActive() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navlinks a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path) a.classList.add('active');
  });
})();

// ---------- scroll reveal (re-runs after dynamic content is injected) ----------
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));
}
initReveal();

// ---------- stat counters ----------
function initCounters() {
  const counters = document.querySelectorAll('.count[data-to]');
  const cio = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el = e.target;
        const to = parseInt(el.dataset.to, 10) || 0;
        let cur = 0;
        const step = Math.max(1, Math.round(to / 40));
        const t = setInterval(() => {
          cur += step;
          if (cur >= to) { cur = to; clearInterval(t); }
          el.textContent = cur;
        }, 30);
        cio.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => cio.observe(c));
}

// ---------- background circuit texture ----------
(function drawBg() {
  const holder = document.getElementById('bgfx');
  if (!holder) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1200 1600');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('stroke', '#2a1f4d');
  g.setAttribute('stroke-width', '1');
  g.setAttribute('opacity', '0.5');
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * 1200, y = Math.random() * 1600;
    const len = 60 + Math.random() * 140;
    const horiz = Math.random() > 0.5;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', x); line.setAttribute('y1', y);
    line.setAttribute('x2', horiz ? x + len : x);
    line.setAttribute('y2', horiz ? y : y + len);
    g.appendChild(line);
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', horiz ? x + len : x);
    dot.setAttribute('cy', horiz ? y : y + len);
    dot.setAttribute('r', '2.4');
    dot.setAttribute('fill', '#7c3aed');
    dot.setAttribute('opacity', '0.55');
    g.appendChild(dot);
  }
  svg.appendChild(g);
  holder.appendChild(svg);
})();

// ---------- helpers ----------
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ---------- load data.json and render whatever containers exist on this page ----------
fetch('data.json?_=' + Date.now())
  .then(r => { if (!r.ok) throw new Error('no data.json'); return r.json(); })
  .then(renderAll)
  .catch(err => {
    console.warn('data.json недоступен (нормально при открытии файла напрямую, без сервера):', err);
  });

function renderAll(data) {
  renderHero(data.hero);
  renderServices(data.services);
  renderProcess(data.process);
  renderPortfolio(data.portfolio);
  renderReviews(data.reviews);
  renderHistory(data.history);
  renderTeam(data.team);
  renderContacts(data.contacts);
  initReveal();
  initCounters();
}

function renderHero(hero) {
  if (!hero) return;
  const eyebrow = document.querySelector('[data-field="hero-eyebrow"]');
  const title = document.querySelector('[data-field="hero-title"]');
  const text = document.querySelector('[data-field="hero-text"]');
  const stats = document.querySelector('[data-field="hero-stats"]');
  if (eyebrow) eyebrow.textContent = hero.eyebrow || '';
  if (title && hero.title) {
    // keep last word/phrase highlighted the same way the design intends: wrap whole title, highlight nothing forcibly
    title.textContent = hero.title;
  }
  if (text) text.textContent = hero.text || '';
  if (stats && Array.isArray(hero.stats)) {
    stats.innerHTML = hero.stats.map(s => `
      <div><b class="count" data-to="${Number(s.value) || 0}">0</b><span>${esc(s.label)}</span></div>
    `).join('');
  }
}

function renderServices(list) {
  const el = document.querySelector('[data-field="services"]');
  if (!el || !Array.isArray(list)) return;
  el.innerHTML = list.map(s => `
    <div class="svc-card reveal">
      <div class="svc-icon">${esc(s.icon || '✦')}</div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.text)}</p>
    </div>
  `).join('');
}

function renderProcess(list) {
  const el = document.querySelector('[data-field="process"]');
  if (!el || !Array.isArray(list)) return;
  el.innerHTML = list.map((p, i) => `
    <div class="process-item reveal">
      <div class="process-num">${String(i + 1).padStart(2, '0')}</div>
      <div><h4>${esc(p.title)}</h4><p>${esc(p.text)}</p></div>
    </div>
  `).join('');
}

function renderPortfolio(list) {
  const el = document.querySelector('[data-field="portfolio"]');
  if (!el || !Array.isArray(list)) return;
  const limit = el.dataset.limit ? parseInt(el.dataset.limit, 10) : list.length;
  el.innerHTML = list.slice(0, limit).map(p => `
    <div class="pf-card reveal">
      <div class="pf-thumb" style="--g:${p.color || 'linear-gradient(140deg,#7c3aed,#2a1750)'}"><span>${esc(p.title)}</span></div>
      <div class="pf-body">
        <span class="pf-tag">${esc(p.tag)}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.text)}</p>
        <div class="pf-stack">${(p.stack || []).map(s => `<span>${esc(s)}</span>`).join('')}</div>
      </div>
    </div>
  `).join('');
}

function renderReviews(list) {
  const el = document.querySelector('[data-field="reviews"]');
  if (!el || !Array.isArray(list)) return;
  const limit = el.dataset.limit ? parseInt(el.dataset.limit, 10) : list.length;
  el.innerHTML = list.slice(0, limit).map(r => `
    <div class="rv-card reveal">
      <div>
        <div class="stars">${'★'.repeat(Math.max(1, Math.min(5, r.rating || 5)))}</div>
        <p>${esc(r.text)}</p>
      </div>
      <div class="rv-person">
        <div class="rv-avatar">${esc(initials(r.name))}</div>
        <div><b>${esc(r.name)}</b><span>${esc(r.role)}</span></div>
      </div>
    </div>
  `).join('');
}

function renderHistory(list) {
  const el = document.querySelector('[data-field="history"]');
  if (!el || !Array.isArray(list)) return;
  el.innerHTML = list.map(h => `
    <div class="tl-item reveal">
      <div class="tl-dot"></div>
      <div class="tl-year">${esc(h.year)}</div>
      <h4>${esc(h.title)}</h4>
      <p>${esc(h.text)}</p>
    </div>
  `).join('');
}

function renderTeam(list) {
  const el = document.querySelector('[data-field="team"]');
  if (!el || !Array.isArray(list)) return;
  const limit = el.dataset.limit ? parseInt(el.dataset.limit, 10) : list.length;
  el.innerHTML = list.slice(0, limit).map(t => `
    <div class="team-card reveal">
      <div class="team-avatar">${t.photo ? `<img src="${esc(t.photo)}" alt="${esc(t.name)}">` : esc(initials(t.name))}</div>
      <h4>${esc(t.name)}</h4>
      <span class="team-role">${esc(t.role)}</span>
      <p>${esc(t.bio)}</p>
      ${t.telegram ? `<a href="${esc(t.telegram)}" target="_blank" rel="noopener" class="team-link">Написать ↗</a>` : ''}
    </div>
  `).join('');
}

function renderContacts(c) {
  if (!c) return;
  document.querySelectorAll('[data-field="contact-channel"]').forEach(el => {
    el.setAttribute('href', c.channel || '#');
  });
  const label = document.querySelector('[data-field="contact-channel-label"]');
  if (label) label.textContent = c.channel_label || c.channel || '';
  const rt = document.querySelector('[data-field="contact-response-time"]');
  if (rt) rt.textContent = c.response_time || '';
}
