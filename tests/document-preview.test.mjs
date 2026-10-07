import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync('dist/app.js','utf8');
const start=source.indexOf('function exportPriceQuote(');
const end=source.indexOf('// Director Mode: One-Click Digital Allotment',start);
function generate(plot,terms) {
 let html='';const ctx={plotData:[plot],currentProject:'avatar3',projectMetadata:{avatar3:{title:'Avatar 3'}},staffEscape:escapeText,escapeDocumentText:escapeText,showDocumentPreview:s=>html=s};
 vm.runInNewContext(source.slice(start,end),ctx);ctx.exportPriceQuote(plot.plot_no,terms);
 return html;
}
function escapeText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const plot={plot_no:125,plot_size:146.67,facing:'West',plot_status:'AVAILABLE',customer_name:'<img src=x onerror=alert(1)>'};
test('quote renders complete escaped document without opening a blank popup',()=>{
 const html=generate(plot);assert.match(html,/Price Quote/);assert.match(html,/22,73,238/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/window.print\(\)/);
 for(const [,js]of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(js);
 assert.doesNotMatch(source.slice(start,end),/window.open/);
});
test('negotiated quote preserves waived mortgage charges and spot discount',()=>{
 const html=generate({...plot,plot_status:'MORTGAGE'},{netRate:14000,spotDiscount:50000,totalAmount:2003380,waiveMortgage:true});
 assert.match(html,/id="lblMortgageRate"[^>]*>₹ 0/);assert.match(html,/id="lblTotalAmount"[^>]*>₹ 20,03,380/);
 assert.match(html,/Math.round\(plotArea \* netClosingRate\) - 50000/);
});
test('editing negotiated rates recalculates total once and keeps registration totals in sync',()=>{
 const html=generate({...plot,plot_status:'MORTGAGE'},{netRate:14000,spotDiscount:50000,totalAmount:2003380,waiveMortgage:true});
 const elements={};
 for(const [,id,text]of html.matchAll(/id="([^"]+)"[^>]*>([^<]*)/g)) {
  elements[id]={innerText:text,handlers:{},addEventListener(name,fn){this.handlers[name]=fn;}};
 }
 const document={getElementById:id=>elements[id]||null,activeElement:null};
 const js=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
 vm.runInNewContext(js,{document});
 const closing=elements.lblClosingPrice;closing.innerText='13000';closing.handlers.input({target:closing});
 assert.equal(elements.lblTotalAmount.innerText,'₹ 18,56,710');
 // A blur with focus elsewhere must not treat a rounded computed discount as a new edit.
 document.activeElement=elements.lblDiscount;closing.handlers.blur();
 assert.equal(elements.lblTotalAmount.innerText,'₹ 18,56,710');
 const bank=elements.lblBankRate;bank.innerText='4000';bank.handlers.input({target:bank});
 assert.equal(elements.lblReg75.innerText,'₹ 44,001');
 assert.equal(elements.lblRegTotal.innerText,'₹ 50,951');
});
