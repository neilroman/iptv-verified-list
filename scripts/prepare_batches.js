const fs = require('fs');
const path = require('path');
const dir = __dirname;

const streams = JSON.parse(fs.readFileSync(path.join(dir, 'streams_raw.json')));
const channels = JSON.parse(fs.readFileSync(path.join(dir, 'channels_raw.json')));

const chanMap = {};
channels.forEach(c => { chanMap[c.id] = c; });

const seen = new Set();
const httpStreams = streams.filter(s => {
  if (!s.url || !s.url.startsWith('http')) return false;
  if (seen.has(s.url)) return false;
  seen.add(s.url);
  return true;
}).map(s => ({
  url: s.url,
  channelId: s.channel || null,
  channelName: s.channel ? (chanMap[s.channel]?.name || s.title || '') : (s.title || ''),
  quality: s.quality || '',
  logo: s.channel ? (chanMap[s.channel]?.logo || '') : '',
  categories: s.channel ? (chanMap[s.channel]?.categories || []) : [],
  country: s.channel ? (chanMap[s.channel]?.country || '') : '',
  languages: s.channel ? (chanMap[s.channel]?.languages || []) : [],
  userAgent: s.user_agent || null,
  referrer: s.referrer || null,
}));

console.log('Total HTTP unique streams:', httpStreams.length);
console.log('With channelId:', httpStreams.filter(s => s.channelId).length);

const BATCHES = 5;
const batchSize = Math.ceil(httpStreams.length / BATCHES);
for (let i = 0; i < BATCHES; i++) {
  const batch = httpStreams.slice(i * batchSize, (i + 1) * batchSize);
  fs.writeFileSync(path.join(dir, `batch_${i}.json`), JSON.stringify(batch));
  console.log(`Batch ${i}: ${batch.length} streams`);
}
console.log('Done.');
