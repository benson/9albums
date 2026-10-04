// fills preview + art for each entry in albums.json via the itunes search api
// entries with "start": "m:ss" (optional "yt": video id to pin the source) get a 30s clip cut from youtube into clips/ (needs yt-dlp + ffmpeg)
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = new URL('../albums.json', import.meta.url);
const albums = JSON.parse(await readFile(file, 'utf8'));
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const force = process.argv.includes('--force');
const slug = a => `${a.artist}-${a.song}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const secs = t => t.split(':').reduce((acc, n) => acc * 60 + Number(n), 0);

for (const a of albums) {
  if (!a.start || (a.clip && !force)) continue;
  const tmp = join(tmpdir(), `9albums-${slug(a)}`);
  await rm(tmp, { recursive: true, force: true });
  const info = execFileSync('python', ['-m', 'yt_dlp', a.yt ? `https://youtu.be/${a.yt}` : `ytsearch1:${a.artist} ${a.song} audio`, '-f', 'bestaudio',
    '-o', join(tmp, 'src.%(ext)s'), '--print', 'after_move:%(title)s | %(channel)s | %(duration_string)s', '-q', '--no-warnings'], { encoding: 'utf8' }).trim();
  await mkdir(new URL('../clips', import.meta.url), { recursive: true });
  const out = `clips/${slug(a)}.m4a`;
  const src = join(tmp, (await readdir(tmp))[0]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(secs(a.start)), '-t', '30', '-i', src,
    '-af', 'afade=t=in:d=0.4,afade=t=out:st=28:d=2', '-vn', '-c:a', 'aac', '-b:a', '128k', fileURLToPath(new URL('../' + out, import.meta.url))]);
  a.clip = out;
  console.log(`clip ${a.start}: ${info}`);
}

for (const a of albums) {
  if ((a.preview || (a.clip && a.art)) && !force) continue;
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
