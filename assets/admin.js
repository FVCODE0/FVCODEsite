// ================= STATE =================
let cfg = { owner: '', repo: '', branch: 'main', token: '' };
let data = null;   // parsed data.json
let sha = null;    // sha of data.json on GitHub (needed to update)
let dirty = false;

const LS_KEY = 'fvcode_admin_cfg';

// ================= HELPERS =================
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str)));
}
function setStatus(text, cls) {
  const el = document.getElementById('connStatus');
  el.textContent = text;
  el.className = 'admin-status' + (cls ? ' ' + cls : '');
}
function setSavebarMsg(text, cls) {
  const msg = document.getElementById('savebarMsg');
  msg.textContent = text;
  msg.className = 'savebar-msg' + (cls ? ' ' + cls : '');
}
function markDirty() {
  dirty = true;
  document.getElementById('savebar').classList.remove('hidden');
  setSavebarMsg('Есть несохранённые изменения');
}
function markClean() {
  dirty = false;
  document.getElementById('savebar').classList.add('hidden');
}

// ================= GITHUB API =================
function apiBase() {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}`;
}
async function ghGetFile(path) {
  const res = await fetch(`${apiBase()}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`, {
    headers: { Authorization: `token ${cfg.token}`, Accept: 'application/vnd.github+json' }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}
async function ghPutFile(path, base64Content, message, existingSha) {
  const body = { message, content: base64Content, branch: cfg.branch };
  if (existingSha) body.sha = existingSha;
  const res = await fetch(`${apiBase()}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`GitHub PUT ${path}: ${res.status} ${errBody.message || res.statusText}`);
  }
  return res.json();
}

// ================= CONFIG PERSISTENCE =================
function loadConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) cfg = JSON.parse(raw);
  } catch (e) {}
}
function saveConfig() {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}
function clearConfig() {
  localStorage.removeItem(LS_KEY);
  cfg = { owner: '', repo: '', branch: 'main', token: '' };
}

// ================= CONNECT / LOAD =================
async function connectAndLoad() {
  cfg.owner = document.getElementById('cfgOwner').value.trim();
  cfg.repo = document.getElementById('cfgRepo').value.trim();
  cfg.branch = document.getElementById('cfgBranch').value.trim() || 'main';
  cfg.token = document.getElementById('cfgToken').value.trim();

  if (!cfg.owner || !cfg.repo || !cfg.token) {
    setStatus('заполните владельца, репозиторий и токен', 'err');
    return;
  }
  saveConfig();
  setStatus('подключение…');
  try {
    const file = await ghGetFile('data.json');
    if (!file) {
      setStatus('data.json не найден в репозитории', 'err');
      return;
    }
    sha = file.sha;
    data = JSON.parse(b64DecodeUnicode(file.content.replace(/\n/g, '')));
    setStatus(`подключено: ${cfg.owner}/${cfg.repo} (${cfg.branch})`, 'ok');
    document.getElementById('editorArea').classList.remove('hidden');
    renderAll();
    markClean();
  } catch (e) {
    console.error(e);
    setStatus('ошибка подключения: ' + e.message, 'err');
  }
}

async function reloadFromGithub() {
  if (dirty && !confirm('Несохранённые изменения будут потеряны. Перезагрузить с GitHub?')) return;
  await connectAndLoad();
}

async function saveAll() {
  setSavebarMsg('Сохраняю…');
  try {
    const content = b64EncodeUnicode(JSON.stringify(data, null, 2));
    const result = await ghPutFile('data.json', content, 'Обновление контента через админ-панель', sha);
    sha = result.content.sha;
    markClean();
    setSavebarMsg('Сохранено ✓ Сайт обновится на GitHub Pages через 1–2 минуты', 'ok');
    document.getElementById('savebar').classList.remove('hidden');
    setTimeout(() => { if (!dirty) document.getElementById('savebar').classList.add('hidden'); }, 4000);
  } catch (e) {
    console.error(e);
    setSavebarMsg('Ошибка сохранения: ' + e.message, 'err');
  }
}

// ================= PHOTO UPLOAD =================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function handlePhotoUpload(input, index) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('teamPhotoPreview' + index);
  if (preview) preview.textContent = '...';
  try {
    const base64 = await fileToBase64(file);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const slug = (data.team[index].name || 'employee' + index)
      .toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '') || ('employee' + index);
    const path = `assets/team/${slug}-${Date.now()}.${ext}`;
    await ghPutFile(path, base64, `Фото сотрудника: ${data.team[index].name || slug}`);
    data.team[index].photo = path;
    markDirty();
    renderSection('team');
  } catch (e) {
    console.error(e);
    alert('Не удалось загрузить фото: ' + e.message);
  }
}

// ================= FIELD UPDATE HELPERS =================
function updateHero(key, value) { data.hero[key] = value; markDirty(); }
function updateContacts(key, value) { data.contacts[key] = value; markDirty(); }
function updateItem(section, index, key, value) { data[section][index][key] = value; markDirty(); }
function updateItemStack(index, value) {
  data.portfolio[index].stack = value.split(',').map(s => s.trim()).filter(Boolean);
  markDirty();
}
function updateHeroStat(index, key, value) {
  data.hero.stats[index][key] = key === 'value' ? (parseInt(value, 10) || 0) : value;
  markDirty();
}
function removeItem(section, index) { data[section].splice(index, 1); renderSection(section); markDirty(); }
function removeHeroStat(index) { data.hero.stats.splice(index, 1); renderSection('heroStats'); markDirty(); }
function addItem(section, blank) { data[section].push(blank); renderSection(section); markDirty(); }
function addHeroStat() { data.hero.stats.push({ value: 0, label: '' }); renderSection('heroStats'); markDirty(); }

// ================= RENDER =================
function renderAll() {
  document.getElementById('cfgOwner').value = cfg.owner;
  document.getElementById('cfgRepo').value = cfg.repo;
  document.getElementById('cfgBranch').value = cfg.branch;

  document.querySelector('[data-hero="eyebrow"]').value = data.hero.eyebrow || '';
  document.querySelector('[data-hero="title"]').value = data.hero.title || '';
  document.querySelector('[data-hero="text"]').value = data.hero.text || '';

  document.querySelector('[data-contacts="channel"]').value = data.contacts.channel || '';
  document.querySelector('[data-contacts="channel_label"]').value = data.contacts.channel_label || '';
  document.querySelector('[data-contacts="response_time"]').value = data.contacts.response_time || '';

  ['heroStats', 'services', 'process', 'portfolio', 'reviews', 'history', 'team'].forEach(renderSection);
}

function renderSection(section) {
  if (section === 'heroStats') return renderHeroStats();
  if (section === 'services') return renderServices();
  if (section === 'process') return renderProcess();
  if (section === 'portfolio') return renderPortfolio();
  if (section === 'reviews') return renderReviews();
  if (section === 'history') return renderHistory();
  if (section === 'team') return renderTeam();
}

function renderHeroStats() {
  const el = document.getElementById('list-heroStats');
  el.innerHTML = data.hero.stats.map((s, i) => `
    <div class="item-card">
      <div class="row2">
        <div><span class="mini-label">Значение</span><input type="number" value="${esc(s.value)}" oninput="updateHeroStat(${i},'value',this.value)"></div>
        <div><span class="mini-label">Подпись</span><input type="text" value="${esc(s.label)}" oninput="updateHeroStat(${i},'label',this.value)"></div>
      </div>
      <div style="text-align:right;margin-top:8px;"><button class="btn btn-danger btn-sm" onclick="removeHeroStat(${i})">Удалить</button></div>
    </div>
  `).join('') || '<p class="state-msg">Пока нет ни одной цифры.</p>';
}

function renderServices() {
  const el = document.getElementById('list-services');
  el.innerHTML = data.services.map((s, i) => `
    <div class="item-card">
      <div class="item-card-head"><span>Услуга №${i + 1}</span><button class="btn btn-danger btn-sm" onclick="removeItem('services',${i})">Удалить</button></div>
      <div class="row3">
        <div><span class="mini-label">Иконка (эмодзи)</span><input type="text" value="${esc(s.icon)}" oninput="updateItem('services',${i},'icon',this.value)"></div>
        <div style="grid-column:span 2;"><span class="mini-label">Название</span><input type="text" value="${esc(s.title)}" oninput="updateItem('services',${i},'title',this.value)"></div>
      </div>
      <div style="margin-top:10px;"><span class="mini-label">Описание</span><textarea oninput="updateItem('services',${i},'text',this.value)">${esc(s.text)}</textarea></div>
    </div>
  `).join('') || '<p class="state-msg">Пока нет услуг.</p>';
}

function renderProcess() {
  const el = document.getElementById('list-process');
  el.innerHTML = data.process.map((p, i) => `
    <div class="item-card">
      <div class="item-card-head"><span>Шаг ${i + 1}</span><button class="btn btn-danger btn-sm" onclick="removeItem('process',${i})">Удалить</button></div>
      <div><span class="mini-label">Название шага</span><input type="text" value="${esc(p.title)}" oninput="updateItem('process',${i},'title',this.value)"></div>
      <div style="margin-top:10px;"><span class="mini-label">Описание</span><textarea oninput="updateItem('process',${i},'text',this.value)">${esc(p.text)}</textarea></div>
    </div>
  `).join('') || '<p class="state-msg">Пока нет шагов.</p>';
}

function renderPortfolio() {
  const el = document.getElementById('list-portfolio');
  el.innerHTML = data.portfolio.map((p, i) => `
    <div class="item-card">
      <div class="item-card-head"><span>Проект №${i + 1}</span><button class="btn btn-danger btn-sm" onclick="removeItem('portfolio',${i})">Удалить</button></div>
      <div class="row2">
        <div><span class="mini-label">Категория</span><input type="text" value="${esc(p.tag)}" oninput="updateItem('portfolio',${i},'tag',this.value)"></div>
        <div><span class="mini-label">Название проекта</span><input type="text" value="${esc(p.title)}" oninput="updateItem('portfolio',${i},'title',this.value)"></div>
      </div>
      <div style="margin-top:10px;"><span class="mini-label">Описание</span><textarea oninput="updateItem('portfolio',${i},'text',this.value)">${esc(p.text)}</textarea></div>
      <div style="margin-top:10px;"><span class="mini-label">Технологии (через запятую)</span><input type="text" value="${esc((p.stack || []).join(', '))}" oninput="updateItemStack(${i},this.value)"></div>
      <div style="margin-top:10px;"><span class="mini-label">Цвет фона карточки (CSS gradient)</span><input type="text" value="${esc(p.color)}" oninput="updateItem('portfolio',${i},'color',this.value)"></div>
    </div>
  `).join('') || '<p class="state-msg">Пока нет проектов.</p>';
}

function renderReviews() {
  const el = document.getElementById('list-reviews');
  el.innerHTML = data.reviews.map((r, i) => `
    <div class="item-card">
      <div class="item-card-head"><span>Отзыв №${i + 1}</span><button class="btn btn-danger btn-sm" onclick="removeItem('reviews',${i})">Удалить</button></div>
      <div class="row3">
        <div><span class="mini-label">Имя</span><input type="text" value="${esc(r.name)}" oninput="updateItem('reviews',${i},'name',this.value)"></div>
        <div><span class="mini-label">Кто (должность)</span><input type="text" value="${esc(r.role)}" oninput="updateItem('reviews',${i},'role',this.value)"></div>
        <div><span class="mini-label">Оценка (1–5)</span><input type="number" min="1" max="5" value="${esc(r.rating)}" oninput="updateItem('reviews',${i},'rating',parseInt(this.value,10)||5)"></div>
      </div>
      <div style="margin-top:10px;"><span class="mini-label">Текст отзыва</span><textarea oninput="updateItem('reviews',${i},'text',this.value)">${esc(r.text)}</textarea></div>
    </div>
  `).join('') || '<p class="state-msg">Пока нет отзывов.</p>';
}

function renderHistory() {
  const el = document.getElementById('list-history');
  el.innerHTML = data.history.map((h, i) => `
    <div class="item-card">
      <div class="item-card-head"><span>Этап №${i + 1}</span><button class="btn btn-danger btn-sm" onclick="removeItem('history',${i})">Удалить</button></div>
      <div class="row2">
        <div><span class="mini-label">Метка (год/период)</span><input type="text" value="${esc(h.year)}" oninput="updateItem('history',${i},'year',this.value)"></div>
        <div><span class="mini-label">Заголовок</span><input type="text" value="${esc(h.title)}" oninput="updateItem('history',${i},'title',this.value)"></div>
      </div>
      <div style="margin-top:10px;"><span class="mini-label">Описание</span><textarea oninput="updateItem('history',${i},'text',this.value)">${esc(h.text)}</textarea></div>
    </div>
  `).join('') || '<p class="state-msg">Пока нет этапов истории.</p>';
}

function renderTeam() {
  const el = document.getElementById('list-team');
  el.innerHTML = data.team.map((t, i) => `
    <div class="item-card">
      <div class="item-card-head"><span>Сотрудник №${i + 1}</span><button class="btn btn-danger btn-sm" onclick="removeItem('team',${i})">Удалить</button></div>
      <div class="row2">
        <div><span class="mini-label">Имя</span><input type="text" value="${esc(t.name)}" oninput="updateItem('team',${i},'name',this.value)"></div>
        <div><span class="mini-label">Роль</span><input type="text" value="${esc(t.role)}" oninput="updateItem('team',${i},'role',this.value)"></div>
      </div>
      <div style="margin-top:10px;"><span class="mini-label">Telegram (ссылка)</span><input type="text" value="${esc(t.telegram)}" oninput="updateItem('team',${i},'telegram',this.value)"></div>
      <div style="margin-top:10px;"><span class="mini-label">Короткое описание</span><textarea oninput="updateItem('team',${i},'bio',this.value)">${esc(t.bio)}</textarea></div>
      <div class="photo-row">
        <div class="photo-preview" id="teamPhotoPreview${i}">${t.photo ? `<img src="${esc(t.photo)}">` : esc((t.name || '?').slice(0, 2).toUpperCase())}</div>
        <div>
          <span class="mini-label">Фото сотрудника</span>
          <input type="file" accept="image/*" onchange="handlePhotoUpload(this,${i})">
        </div>
      </div>
    </div>
  `).join('') || '<p class="state-msg">Пока нет сотрудников.</p>';
}

// ================= RAW JSON =================
function toggleJsonBox() {
  const box = document.getElementById('jsonBox');
  const btn = document.getElementById('toggleJson');
  if (box.classList.contains('hidden')) {
    document.getElementById('jsonTextarea').value = JSON.stringify(data, null, 2);
    box.classList.remove('hidden');
    btn.textContent = 'Скрыть JSON';
  } else {
    box.classList.add('hidden');
    btn.textContent = 'Показать JSON';
  }
}
function applyJson() {
  try {
    const parsed = JSON.parse(document.getElementById('jsonTextarea').value);
    data = parsed;
    renderAll();
    markDirty();
    alert('JSON применён к формам. Не забудьте нажать «Сохранить и опубликовать».');
  } catch (e) {
    alert('Некорректный JSON: ' + e.message);
  }
}

// ================= EVENT WIRING =================
document.getElementById('btnConnect').addEventListener('click', connectAndLoad);
document.getElementById('btnDisconnect').addEventListener('click', () => {
  clearConfig();
  document.getElementById('cfgOwner').value = '';
  document.getElementById('cfgRepo').value = '';
  document.getElementById('cfgToken').value = '';
  document.getElementById('cfgBranch').value = 'main';
  document.getElementById('editorArea').classList.add('hidden');
  setStatus('не подключено');
  markClean();
});
document.getElementById('btnSave').addEventListener('click', saveAll);
document.getElementById('btnReload').addEventListener('click', reloadFromGithub);
document.getElementById('toggleJson').addEventListener('click', toggleJsonBox);
document.getElementById('jsonApply').addEventListener('click', applyJson);

document.getElementById('addHeroStat').addEventListener('click', addHeroStat);
document.getElementById('addService').addEventListener('click', () => addItem('services', { icon: '✦', title: '', text: '' }));
document.getElementById('addProcess').addEventListener('click', () => addItem('process', { title: '', text: '' }));
document.getElementById('addPortfolio').addEventListener('click', () => addItem('portfolio', { tag: '', title: '', text: '', stack: [], color: 'linear-gradient(140deg,#7c3aed,#2a1750)' }));
document.getElementById('addReview').addEventListener('click', () => addItem('reviews', { name: '', role: '', text: '', rating: 5 }));
document.getElementById('addHistory').addEventListener('click', () => addItem('history', { year: '', title: '', text: '' }));
document.getElementById('addTeam').addEventListener('click', () => addItem('team', { name: '', role: '', telegram: '', bio: '', photo: '' }));

document.querySelector('[data-hero="eyebrow"]').addEventListener('input', (e) => updateHero('eyebrow', e.target.value));
document.querySelector('[data-hero="title"]').addEventListener('input', (e) => updateHero('title', e.target.value));
document.querySelector('[data-hero="text"]').addEventListener('input', (e) => updateHero('text', e.target.value));
document.querySelector('[data-contacts="channel"]').addEventListener('input', (e) => updateContacts('channel', e.target.value));
document.querySelector('[data-contacts="channel_label"]').addEventListener('input', (e) => updateContacts('channel_label', e.target.value));
document.querySelector('[data-contacts="response_time"]').addEventListener('input', (e) => updateContacts('response_time', e.target.value));

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

// ================= INIT =================
loadConfig();
if (cfg.owner && cfg.repo && cfg.token) {
  document.getElementById('cfgOwner').value = cfg.owner;
  document.getElementById('cfgRepo').value = cfg.repo;
  document.getElementById('cfgBranch').value = cfg.branch;
  document.getElementById('cfgToken').value = cfg.token;
  connectAndLoad();
}
