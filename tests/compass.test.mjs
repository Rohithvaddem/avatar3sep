import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('app.js','utf8');const scope={};
vm.runInNewContext(source.slice(source.indexOf('function matchesPlotFacing('),source.indexOf("document.addEventListener('facing-selection-changed'")),scope);
test('compass multi-select includes exact directions without broadening corner facings',()=>{
 const match=scope.matchesPlotFacing;
 assert.equal(match('East',['North-East','East']),true);
 assert.equal(match('North-East',['North-East','East']),true);
 assert.equal(match('South-East',['North-East','East']),false);
 assert.equal(match('North-West',['North','West']),false);
 assert.equal(match('North-West',['North-West']),true);
 for(const name of ['North','North-East','East','South-East','South','South-West','West','North-West'])assert.equal(match(name,[name]),true);
});
