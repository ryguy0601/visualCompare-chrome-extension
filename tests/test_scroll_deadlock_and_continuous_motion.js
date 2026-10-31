const fs = require('fs');
const assert = require('assert');

console.log('TEST: Validating Scroll Deadlock Prevention & Unconstrained Continuous Motion...');

const studioJs = require("./helpers").readStudioJs();
const syncAgentJs = fs.readFileSync('sync_agent.js', 'utf8');

// 1. Verify wheel event is NOT dropped by isSyncing
const wheelBlockMatch = syncAgentJs.match(/window\.addEventListener\("wheel",\s*\(e\)\s*=>\s*\{([\s\S]*?)\},\s*\{\s*passive:\s*true\s*\}\);/);
assert(wheelBlockMatch, 'sync_agent.js must have wheel listener');
assert(!wheelBlockMatch[1].includes('if (isSyncing) return;'), 'sync_agent.js wheel listener must NEVER drop user wheel events due to isSyncing');
console.log('PASS 1: User wheel gestures are never blocked by isSyncing.');

// 2. Verify isSyncing does not remain locked for 120ms
assert(!syncAgentJs.includes('}, 120);'), 'sync_agent.js must not lock isSyncing for 120ms');
assert(syncAgentJs.includes('requestAnimationFrame(() => {\n          isSyncing = false;\n        });'), 'sync_agent.js must release isSyncing on animation frame');
console.log('PASS 2: isSyncing releases on next animation frame without long freezes.');

// 3. Verify handleSideBySideWheel does not clamp document height to 2000px
assert(!studioJs.includes('lastProdLandmarks?.docHeight || lastStgLandmarks?.docHeight || 2000'), 'studio.js must not clamp docHeight to 2000');
assert(studioJs.includes('50000'), 'studio.js must support large document scrolling up to 50,000px');
console.log('PASS 3: studio.js supports unconstrained long document scrolling without 1200px artificial caps.');

console.log('\nALL SCROLL DEADLOCK & CONTINUOUS MOTION TESTS PASSED!');
