const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('avatar3_live_view.js','utf8');
const start = source.indexOf('    function solarPosition(');
const end = source.indexOf('    let sunMarker;', start);
const calculate = vm.runInNewContext(source.slice(start,end)+'; solarPosition;');
for (const date of ['2026-03-20','2026-06-21','2026-10-05','2026-12-21']) {
  const morning=calculate(date,8), noon=calculate(date,12), afternoon=calculate(date,16);
  assert(morning.east>0 && afternoon.east<0, 'Morning is east and afternoon west');
  assert(noon.elevation>morning.elevation && noon.elevation>afternoon.elevation, 'Midday sun is higher');
  assert(Math.abs(morning.east**2+morning.north**2+morning.up**2-1)<1e-10, 'Direction has unit length');
}
assert(calculate('2026-06-21',12).elevation>calculate('2026-12-21',12).elevation, 'Summer midday sun is higher');
assert.equal(calculate('invalid',12),null);
console.log('Solar direction, seasonal elevation and invalid-date checks passed.');

