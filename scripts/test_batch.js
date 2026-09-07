/**
 * ItvIptv — Stream batch tester
 * Usage: node test_batch.js <batchIndex>
 * Outputs: results_<batchIndex>.json
 */
const fs   = require('fs');
const path = require('path');
const http  = require('http');
const https = require('https');
const { URL } = require('url');

const BATCH_INDEX  = parseInt(process.argv[2] ?? '0', 10);
const CONCURRENCY  = 50;
const TIMEOUT_MS   = 7000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const dir   = __dirname;
const batch = JSON.parse(fs.readFileSync(path.join(dir, `batch_${BATCH_INDEX}.json`)));

const alive  = [];
const dead   = [];
let   done   = 0;

function probe(stream) {
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(stream.url); } catch { return resolve({ ...stream, status: -1, alive: false }); }

    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'HEAD',
      timeout:  TIMEOUT_MS,
      headers: {
        'User-Agent': stream.userAgent || UA,
        'Accept':     '*/*',
        ...(stream.referrer ? { 'Referer': stream.referrer } : {}),
      },
    };

    const req = mod.request(options, res => {
      res.resume();
      const code = res.statusCode;
      const ok = code >= 200 && code < 400;
      resolve({ ...stream, status: code, alive: ok });
    });

    req.on('timeout', () => { req.destroy(); resolve({ ...stream, status: 0, alive: false }); });
    req.on('error',   () => resolve({ ...stream, status: -1, alive: false }));
    req.end();
  });
}

async function runBatch() {
  const total = batch.length;
  console.log(`[Batch ${BATCH_INDEX}] Iniciando ${total} streams con concurrencia ${CONCURRENCY}`);

  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < batch.length) {
      const stream = batch[idx++];
      const result = await probe(stream);
      done++;
      if (result.alive) alive.push(result); else dead.push(result);
      if (done % 200 === 0 || done === total) {
        const pct = ((done / total) * 100).toFixed(1);
        console.log(`[Batch ${BATCH_INDEX}] ${done}/${total} (${pct}%) — vivos: ${alive.length}`);
      }
    }
  });

  await Promise.all(workers);

  const results = { batchIndex: BATCH_INDEX, total, alive: alive.length, dead: dead.length, streams: alive };
  fs.writeFileSync(path.join(dir, `results_${BATCH_INDEX}.json`), JSON.stringify(results, null, 2));
  console.log(`[Batch ${BATCH_INDEX}] LISTO — ${alive.length}/${total} streams activos → results_${BATCH_INDEX}.json`);
}

runBatch().catch(console.error);
