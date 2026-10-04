// fills preview + art for each entry in albums.json via the itunes search api
import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../albums.json', import.meta.url);
const albums = JSON.parse(await readFile(file, 'utf8'));
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

for (const a of albums) {
  if (a.preview && !process.argv.includes('--force')) continue;
  const term = encodeURIComponent(`${a.artist} ${a.song}`);
  const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=25`);
  const { results } = await res.json();
  const songs = results.filter(r => r.previewUrl && norm(r.trackName).startsWith(norm(a.song)));
  const hit = songs.find(r => norm(r.collectionName).includes(norm(a.album))) || songs[0];
  if (!hit) { console.log(`no match: ${a.artist} — ${a.song}`); continue; }
  a.preview = hit.previewUrl;
  a.art = hit.artworkUrl100.replace('100x100bb', '1000x1000bb');
  console.log(`${a.song} → ${hit.collectionName}${norm(hit.collectionName).includes(norm(a.album)) ? '' : '  (album mismatch, check)'}`);
}

await writeFile(file, JSON.stringify(albums, null, 2) + '\n');
