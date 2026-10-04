const grid = document.getElementById('grid');
const editing = new URLSearchParams(location.search).has('edit');
const KEY = '9albums-order';
const cut = Object.assign(document.createElement('li'), { className: 'cut', ariaHidden: true });
const audio = new Audio();
const C = 2 * Math.PI * 45;
let current = null;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function tile(a) {
  const li = document.createElement('li');
  li.dataset.key = a.clip || a.preview || a.album;
  li.innerHTML = `
    <button class="cover" aria-label="play ${esc(a.song)} by ${esc(a.artist)}">
      ${a.art ? `<img src="${esc(a.art)}" alt="" loading="lazy">` : ''}
      <span class="ring"><svg viewBox="0 0 100 100">
        <circle class="track" cx="50" cy="50" r="45"/>
        <circle class="bar" cx="50" cy="50" r="45" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
        <path class="icon play" d="M40 32 L70 50 L40 68 Z"/>
        <path class="icon pause" d="M37 33 h9 v34 h-9 Z M54 33 h9 v34 h-9 Z"/>
      </svg></span>
    </button>
    <div class="meta">
      <div class="album">${esc(a.album)}</div>
      <div class="artist">${esc(a.artist)}</div>
      <div class="song">${esc(a.song)}</div>
    </div>`;
  li.querySelector('.cover').addEventListener('click', e => {
    if (li.dataset.dragged) { delete li.dataset.dragged; return; }
    toggle(li, a);
  });
  if (editing) draggable(li);
  return li;
}

function stop() {
  audio.pause();
  if (current) {
    current.classList.remove('playing');
    current.querySelector('.bar').style.strokeDashoffset = C;
  }
  current = null;
}

function toggle(li, a) {
  const same = current === li;
  stop();
  const src = a.clip || a.preview;
  if (same || !src) return;
  current = li;
  li.classList.add('playing');
  audio.src = src;
  audio.currentTime = 0;
  audio.play().catch(stop);
}

audio.addEventListener('timeupdate', () => {
  if (!current || !audio.duration) return;
  current.querySelector('.bar').style.strokeDashoffset = C * (1 - audio.currentTime / audio.duration);
});
audio.addEventListener('ended', stop);

function tiles() { return [...grid.children].filter(el => el !== cut); }

function placeCut() {
  const all = tiles();
  all.forEach((li, i) => li.classList.toggle('out', i >= 9));
  if (all.length > 9) grid.insertBefore(cut, all[9]); else cut.remove();
}

function saveOrder() {
  try { localStorage.setItem(KEY, JSON.stringify(tiles().map(li => li.dataset.key))); } catch {}
}

function draggable(li) {
  const cover = li.querySelector('.cover');
  let start, timer, dragging = false;

  const begin = () => {
    dragging = true;
    li.classList.add('dragging');
    grid.classList.add('sorting');
  };

  cover.addEventListener('pointerdown', e => {
    if (e.button) return;
    start = { x: e.clientX, y: e.clientY };
    cover.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') timer = setTimeout(begin, 250);
  });

  cover.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!dragging) {
      if (Math.hypot(dx, dy) < 6) return;
      if (e.pointerType === 'touch') { clearTimeout(timer); start = null; return; }
      begin();
    }
    li.style.transform = `translate(${dx}px, ${dy}px)`;
    li.style.visibility = 'hidden';
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('#grid > li:not(.cut)');
    li.style.visibility = '';
    if (!over || over === li) return;
    const all = tiles();
    const before = all.indexOf(over) < all.indexOf(li) ? over : over.nextSibling;
    const r0 = li.getBoundingClientRect();
    grid.insertBefore(li, before);
    placeCut();
    const r1 = li.getBoundingClientRect();
    start.x += r1.left - r0.left;
    start.y += r1.top - r0.top;
    li.style.transform = `translate(${e.clientX - start.x}px, ${e.clientY - start.y}px)`;
  });

  const end = () => {
    clearTimeout(timer);
    start = null;
    if (!dragging) return;
    dragging = false;
    li.dataset.dragged = 1;
    li.style.transform = '';
    li.classList.remove('dragging');
    grid.classList.remove('sorting');
    saveOrder();
  };
  cover.addEventListener('pointerup', end);
  cover.addEventListener('pointercancel', end);
  cover.addEventListener('touchmove', e => { if (dragging) e.preventDefault(); }, { passive: false });
  cover.addEventListener('contextmenu', e => e.preventDefault());
}

function sorted(albums) {
  let order = [];
  try { order = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
  const rank = k => { const i = order.indexOf(k); return i < 0 ? Infinity : i; };
  return albums.map((a, i) => ({ a, i })).sort((x, y) => {
    const kx = x.a.clip || x.a.preview || x.a.album, ky = y.a.clip || y.a.preview || y.a.album;
    return rank(kx) - rank(ky) || x.i - y.i;
  }).map(x => x.a);
}

fetch('albums.json?v=' + Date.now())
  .then(r => r.json())
  .then(albums => {
    if (editing) {
      document.body.classList.add('editing');
      albums = sorted(albums);
      document.getElementById('copy').addEventListener('click', e => {
        const order = tiles().map(li => li.querySelector('.album').textContent).join('\n');
        navigator.clipboard.writeText(order).then(() => { e.target.textContent = 'copied'; });
      });
    }
    albums.forEach(a => grid.appendChild(tile(a)));
    placeCut();
  });
