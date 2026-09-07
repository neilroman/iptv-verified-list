/**
 * ItvIptv — Stream batch tester with header-aware retry
 * Usage: node test_batch.js <batchIndex>
 * Outputs: results_<batchIndex>.json
 *
 * Flow per stream:
 *   1. Try with the stream's own headers (from iptv-org metadata)
 *   2. If fails → retry with each RETRY_PROFILES entry
 *   3. Save the working headers in the result so the app uses them
 */
const fs    = require('fs');
const path  = require('path');
const http  = require('http');
const https = require('https');
const { URL } = require('url');

const BATCH_INDEX  = parseInt(process.argv[2] ?? '0', 10);
const CONCURRENCY  = 50;
const TIMEOUT_MS   = 7000;

// Common IPTV clients — tried in order when bare request fails
const RETRY_PROFILES = [
  { ua: 'VLC/3.0.20 LibVLC/3.0.20',                                                  referer: null       },
  { ua: 'Kodi/20.2 (Linux;Android 12) ExoPlayerLib/2.18.1',                          referer: 'domain'   },
  { ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/124 Mobile',   referer: null       },
  { ua: 'stagefright/1.2 (Linux;Android 11)',                                         referer: 'domain'   },
  { ua: 'okhttp/4.12.0',                                                              referer: null       },
  { ua: 'lavf/60.3.100',                                                              referer: 'domain'   },
  { ua: 'AppleCoreMedia/1.0.0.21G115 (iPad; U; CPU OS 17_5 like Mac OS X; en_us)',   referer: null       },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125',   referer: null       },
];

const dir   = __dirname;
const batch = JSON.parse(fs.readFileSync(path.join(dir, `batch_${BATCH_INDEX}.json`)));

function domainReferer(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/`;
  } catch { return null; }
}

function probeOnce(stream, ua, referer) {
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(stream.url); } catch { return resolve(false); }

    const mod = parsed.protocol === 'https:' ? https : http;
    const headers = { 'User-Agent': ua, 'Accept': '*/*' };
    if (referer) headers['Referer'] = referer;

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'HEAD',
      timeout:  TIMEOUT_MS,
      headers,
    };

    const req = mod.request(options, res => {
      res.resume();
      const code = res.statusCode;
      resolve(code >= 200 && code < 400 ? code : false);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error',   () => resolve(false));
    req.end();
  });
}

async function probe(stream) {
  // --- Pass 1: use stream's own headers from iptv-org metadata ---
  const ownUa  = stream.userAgent || 'Mozilla/5.0';
  const ownRef = stream.referrer  || null;
  const code1  = await probeOnce(stream, ownUa, ownRef);
  if (code1 !== false) {
    return { ...stream, status: code1, alive: true, resolvedVia: 'direct' };
  }

  // --- Pass 2: retry with IPTV client profiles ---
  for (const profile of RETRY_PROFILES) {
    const referer = profile.referer === 'domain' ? domainReferer(stream.url) : profile.referer;
    const code = await probeOnce(stream, profile.ua, referer);
    if (code !== false) {
      return {
        ...stream,
        status:      code,
        alive:       true,
        resolvedVia: 'header-retry',
        userAgent:   profile.ua,
        referrer:    referer || stream.referrer || null,
      };
    }
  }

  return { ...stream, status: 0, alive: false, resolvedVia: 'dead' };
}

async function runBatch() {
  const total = batch.length;
  console.log(`[Batch ${BATCH_INDEX}] ${total} streams | concurrencia ${CONCURRENCY} | ${RETRY_PROFILES.length} perfiles de reintento`);

  const alive  = [];
  const dead   = [];
  let   done   = 0;
  let   idx    = 0;
  let   retried = 0;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < batch.length) {
      const stream = batch[idx++];
      const result = await probe(stream);
      done++;
      if (result.alive) {
        alive.push(result);
        if (result.resolvedVia === 'header-retry') retried++;
      } else {
        dead.push(result);
      }
      if (done % 200 === 0 || done === total) {
        const pct = ((done / total) * 100).toFixed(1);
        console.log(`[Batch ${BATCH_INDEX}] ${done}/${total} (${pct}%) — vivos: ${alive.length} (${retried} por headers)`);
      }
    }
  });

  await Promise.all(workers);

  const results = {
    batchIndex: BATCH_INDEX,
    total,
    alive:   alive.length,
    retried,
    dead:    dead.length,
    streams: alive,
  };
  fs.writeFileSync(path.join(dir, `results_${BATCH_INDEX}.json`), JSON.stringify(results));
  console.log(`[Batch ${BATCH_INDEX}] LISTO — ${alive.length}/${total} vivos (${retried} rescatados por headers)`);
}

runBatch().catch(console.error);
