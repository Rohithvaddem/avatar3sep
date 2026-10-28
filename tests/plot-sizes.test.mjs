import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHandler} from '../server/staff-core.mjs';
const expected=JSON.parse(readFileSync('tests/fixtures/avatar3-rounded-areas.json','utf8'));
test('every Avatar 3 plot size matches the PDF ROUND OF column in online and offline datasets',()=>{
  for(const file of ['avatar3_data.json','data.json','avatar3_data.js','data.js']) {
    const source=readFileSync(file,'utf8');
    const data=file.endsWith('.json')?JSON.parse(source):vm.runInNewContext(source+';'+(file==='data.js'?'plotDataRaw':'plotDataRawAvatar3'));
    const plots=data.filter(row=>/^\d+$/.test(String(row.plot_no)));
    assert.equal(plots.length,206,file);
    assert.equal(new Set(plots.map(row=>String(row.plot_no))).size,206,file);
    for(const row of plots)assert.equal(String(row.plot_size),expected[row.plot_no],`${file}: plot ${row.plot_no}`);
    assert.equal(plots.reduce((sum,row)=>sum+Number(row.plot_size),0),35547);
  }
});
test('existing hosted inventory uses corrected Avatar 3 areas and retains customer and status fields',async()=>{
  const handler=createHandler({getUser:async()=>({roles:['staff']}),seed:async()=>[{plot_no:'62',plot_size:'268'}],store:()=>({getWithMetadata:async()=>({data:[{plot_no:'62',plot_size:'244',plot_status:'SOLD',customer_name:'Test customer'}],etag:'v1'})})});
  const response=await handler(new Request('https://example.test/?action=plots&project=avatar3'));
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.plots[0].plot_size,'268');
  assert.equal(result.plots[0].plot_status,'SOLD');
  assert.equal(result.plots[0].customer_name,'Test customer');
});
