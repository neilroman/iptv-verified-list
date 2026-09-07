/**
 * Merges all batch results into data/verified_streams.json
 * Run from the repo root or scripts/ directory after all test_batch.js complete.
 */
const fs   = require('fs');
const path = require('path');

const dir     = __dirname;                          // scripts/
const rootDir = path.join(dir, '..');               // repo root
const BATCHES = 5;

const allAlive = [];
let totalProbed = 0;

for (let i = 0; i < BATCHES; i++) {
  const f = path.join(dir, `results_${i}.json`);
  const r = JSON.parse(fs.readFileSync(f));
  allAlive.push(...r.streams);
  totalProbed += r.total;
  console.log(`Batch ${i}: ${r.alive} vivos / ${r.total}`);
}

// Deduplicate by URL (just in case)
const seen = new Set();
const unique = allAlive.filter(s => {
  if (seen.has(s.url)) return false;
  seen.add(s.url);
  return true;
});

// Build channel map: channelId → best stream URL (first alive)
const channelMap = {};
unique.forEach(s => {
  if (!s.channelId) return;
  if (!channelMap[s.channelId]) {
    channelMap[s.channelId] = {
      channelId:   s.channelId,
      channelName: s.channelName,
      logo:        s.logo,
      categories:  s.categories,
      country:     s.country,
      languages:   s.languages,
      streams:     [],
    };
  }
  channelMap[s.channelId].streams.push({
    url:       s.url,
    quality:   s.quality,
    status:    s.status,
    userAgent: s.userAgent,
    referrer:  s.referrer,
  });
});

// Channels with known channelId
const namedChannels = Object.values(channelMap);

// Streams without channelId (standalone)
const orphans = unique.filter(s => !s.channelId).map(s => ({
  channelId:   null,
  channelName: s.channelName || 'Canal sin nombre',
  logo:        '',
  categories:  [],
  country:     '',
  languages:   [],
  streams: [{
    url:       s.url,
    quality:   s.quality,
    status:    s.status,
    userAgent: s.userAgent,
    referrer:  s.referrer,
  }],
}));

const output = {
  generatedAt:     new Date().toISOString(),
  totalProbed,
  totalAlive:      unique.length,
  namedChannels:   namedChannels.length,
  orphanStreams:   orphans.length,
  channels:        namedChannels,
  orphans,
};

const outPath = path.join(rootDir, 'data', 'verified_streams.json');
if (!fs.existsSync(path.join(rootDir, 'data'))) fs.mkdirSync(path.join(rootDir, 'data'), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output));

console.log(`\nTotal probados : ${totalProbed}`);
console.log(`Total vivos    : ${unique.length} (${((unique.length/totalProbed)*100).toFixed(1)}%)`);
console.log(`Canales con ID : ${namedChannels.length}`);
console.log(`Streams huérfanos: ${orphans.length}`);
console.log(`Escrito en     : ${outPath}`);
console.log(`Tamaño         : ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB`);
