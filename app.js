const grid = document.getElementById('grid');
const audio = new Audio();
const C = 2 * Math.PI * 45;
let current = null;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function tile(a) {
  const li = document.createElement('li');
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
  li.querySelector('.cover').addEventListener('click', () => toggle(li, a));
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
  if (same || !a.preview) return;
  current = li;
  li.classList.add('playing');
  audio.src = a.preview;
  audio.currentTime = 0;
  audio.play().catch(stop);
}

audio.addEventListener('timeupdate', () => {
  if (!current || !audio.duration) return;
  current.querySelector('.bar').style.strokeDashoffset = C * (1 - audio.currentTime / audio.duration);
});
audio.addEventListener('ended', stop);

fetch('albums.json?v=' + Date.now())
  .then(r => r.json())
  .then(albums => {
    document.getElementById('count').textContent = albums.length || 9;
    if (!albums.length) albums = Array(9).fill({ album: '', artist: '', song: '' });
    albums.forEach(a => grid.appendChild(tile(a)));
  });
