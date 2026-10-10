// Reuse existing controls and their handlers across the three map views.
function setupMapShell() {
    document.body.classList.add('layout-shell');
    const header=document.querySelector('.dashboard-header');
    const sidebar=document.getElementById('sidebar');
    const content=sidebar.querySelector('.sidebar-content');
    const search=document.getElementById('searchSection');
    const facing=document.getElementById('filtersSection');
    facing.remove();
    const brand=sidebar.querySelector('.logo-container');
    const identity=header.querySelector('.header-left');
    identity.querySelector('.sidebar-toggle').after(brand);
    const brandImage=brand.querySelector('img');
    brandImage.src='assets/aspirealty-label.png';
    brandImage.alt='Aspirealty';
    const drawerTitle=document.createElement('strong'); drawerTitle.textContent='Plot tools';
    drawerTitle.style.marginRight='auto'; sidebar.querySelector('.sidebar-header').prepend(drawerTitle);
    document.getElementById('searchPlotBtn').setAttribute('aria-label','Search plot number');
    const toolbar=document.createElement('div'); toolbar.className='map-tool-strip';
    const tools=document.createElement('button'); tools.className='shell-tools-button'; tools.type='button';
    tools.setAttribute('aria-controls','sidebar');
    tools.innerHTML='<i class="fa-solid fa-sliders" aria-hidden="true"></i><span>Plot tools</span>';
    tools.onclick=()=>document.getElementById('sidebarToggleBtn').click();
    toolbar.append(search,tools); document.querySelector('.map-viewport').append(toolbar);
    tools.setAttribute('aria-label','Open plot tools and filters'); tools.title='Plot tools';
    const booking=document.getElementById('floatingSiteVisitBtn');
    header.append(booking);
    const mobileActions=document.createElement('div'); mobileActions.className='shell-mobile-actions';
    const finder=document.querySelector('.rt-mobile-finder');
    finder.setAttribute('aria-label','Find plots: search and filters'); finder.title='Search and filter plots';
    finder.onclick=()=>document.getElementById('sidebarToggleBtn').click();
    mobileActions.append(finder); document.body.append(mobileActions);
    const small=matchMedia('(max-width:992px)');
    const description=document.querySelector('.project-description');
    description.innerHTML='<strong>13 Acres</strong><span>Open plots</span><span>DTCP approved layout</span>';
    description.classList.add('shell-project-tags');
    const legend=document.getElementById('floatingLegendCard');
    const setLegendDefault=()=>{
        legend.classList.add('collapsed');
        document.getElementById('floatingLegendToggle').setAttribute('aria-expanded','false');
    };
    const arrange=()=>{
        if(small.matches) { content.prepend(search); mobileActions.append(booking); toolbar.append(description); }
        else {
            if(sidebar.classList.contains('show')) { content.prepend(search); }
            else { toolbar.prepend(search);  }
            header.append(booking);
            toolbar.append(description);
        }
        requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    };
    small.addEventListener('change',()=>{arrange();setLegendDefault();}); arrange(); setLegendDefault();
    const legendToggle=document.getElementById('floatingLegendToggle');
    legendToggle.setAttribute('aria-label','Toggle plot status legend');
    new MutationObserver(()=>legendToggle.setAttribute('aria-expanded',String(!legend.classList.contains('collapsed')))).observe(legend,{attributes:true,attributeFilter:['class']});
    const menuButton=document.getElementById('sidebarToggleBtn');
    menuButton.setAttribute('aria-controls','sidebar');
    const syncDrawer=()=>{
        const open=sidebar.classList.contains('show');
        if(!small.matches) {
            if(open) { content.prepend(search); }
            else { toolbar.prepend(search);  }
        }
        sidebar.inert=!open;
        menuButton.setAttribute('aria-expanded',String(open));
        tools.setAttribute('aria-expanded',String(open));
        finder.setAttribute('aria-expanded',String(open));
    };
    new MutationObserver(syncDrawer).observe(sidebar,{attributes:true,attributeFilter:['class']});
    syncDrawer();
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){sidebar.classList.remove('show');document.querySelector('.sidebar-backdrop')?.classList.remove('active');}});
    setupCompactChrome(header,toolbar,small,tools,legend);
    setupFacingCompass(small,legend);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setupMapShell); else setupMapShell();
function setupCompactChrome(header,toolbar,small,tools,legend) {
 const info=header.querySelector('.header-project-info');
 const approvals=document.createElement('dialog'); approvals.className='approval-popover'; approvals.id='approvalPopover';
 approvals.innerHTML='<button type="button" class="approval-close" aria-label="Close project approvals"><i class="fa-solid fa-xmark"></i></button><h3>Project approvals</h3>';
 approvals.append(info.querySelector('.project-registrations'));
 document.body.append(approvals);
 const chip=document.createElement('a');chip.className='registration-image-link';chip.href='https://rerait.telangana.gov.in/searchlist/search?CertficateNo=P02400011281';chip.title=chip.href;chip.target='_blank';chip.rel='noopener noreferrer';chip.innerHTML='<img src="assets/project-registrations.png" alt="RERA P02400011281 · DTCP TLP 09-2024-H">';info.append(chip);
 const searchOpen=document.createElement('button');searchOpen.className='mobile-search-open';searchOpen.type='button';searchOpen.setAttribute('aria-label','Open plot search');searchOpen.innerHTML='<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>';
 searchOpen.onclick=()=>{if(!document.getElementById('sidebar').classList.contains('show'))document.getElementById('sidebarToggleBtn').click();document.getElementById('searchInput').focus();};header.append(searchOpen);
 const viewMenu=document.createElement('details');viewMenu.className='mobile-view-menu';const viewSummary=document.createElement('summary');viewSummary.innerHTML='<i class="fa-solid fa-map" aria-hidden="true"></i><span>Schematic</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';viewMenu.append(viewSummary);toolbar.prepend(viewMenu);viewMenu.addEventListener('toggle',()=>{if(small.matches&&viewMenu.open)legend.classList.add('collapsed');});
 const nav=document.getElementById('viewSwitchContainer'); const navHome=header.querySelector('.header-center-actions');
 const updateView=()=>{const active=nav.querySelector('.active');viewSummary.querySelector('span').textContent=active?.id==='btn3DView'?'3D':active?.id==='btnSatelliteView'?'Satellite':'Schematic';};
 new MutationObserver(updateView).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 nav.querySelectorAll('button').forEach(b=>{const label=b.querySelector('span');if(label)label.textContent=b.id==='btn3DView'?'3D':b.id==='btnSatelliteView'?'Satellite':'Schematic';b.addEventListener('click',()=>{viewMenu.open=false;});});
 const position=()=>{if(small.matches){viewMenu.append(nav);}else{navHome.append(nav);}};
 small.addEventListener('change',position);position();
 document.getElementById('openPlotFinderSidebarBtn').innerHTML='<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> <span>Smart finder</span>';
 const recenter=document.querySelector('.floating-recenter-btn'); recenter.setAttribute('aria-label','Recenter layout');recenter.title='Recenter layout';
 const zoom=document.querySelector('.map-controls');zoom.prepend(recenter);
 const legendHeader=document.getElementById('floatingLegendHeader');
 const summary=document.createElement('span');summary.className='status-summary';legendHeader.querySelector('.floating-legend-title').replaceWith(summary);
 const syncCounts=()=>{const rows=Array.from(document.querySelectorAll('#floatingLegendBody .floating-legend-item')); const labels=['Available','Sold','Mortgage'];summary.replaceChildren();rows.slice(0,3).forEach((row,index)=>{const item=document.createElement('span');item.className='status-summary-item';const dot=document.createElement('i');dot.className='color-dot';dot.style.backgroundColor=row.style.getPropertyValue('--status-color');const count=document.createElement('strong');count.textContent=row.querySelector('.count-badge')?.textContent||'0';item.append(dot,count,document.createTextNode(' '+labels[index]));summary.append(item);});rows.forEach(row=>{row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-pressed',String(row.classList.contains('active')));row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}};});};
 new MutationObserver(syncCounts).observe(document.getElementById('floatingLegendBody'),{childList:true});syncCounts();
 const toggle=document.getElementById('floatingLegendToggle');toggle.setAttribute('aria-controls','floatingLegendBody');
 legend.addEventListener('keydown',e=>{if(e.key==='Escape'&&!legend.classList.contains('collapsed')){legend.classList.add('collapsed');toggle.focus();}});
 document.addEventListener('click',e=>{if(!viewMenu.contains(e.target))viewMenu.open=false;});
}
function setupFacingCompass(small,legend) {
 const card=document.createElement('div');card.id='facingCompass';card.className='facing-compass';card.setAttribute('aria-label','Facing filter');
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 200 200');card.append(svg);
 const add=(tag,attrs,parent=svg)=>{const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));parent.append(el);return el;};
 const polar=(r,a)=>[100+r*Math.sin(a*Math.PI/180),100-r*Math.cos(a*Math.PI/180)];
 const names=['North','North-East','East','South-East','South','South-West','West','North-West'],labels=['N','NE','E','SE','S','SW','W','NW'];let selected=[],count=206,total=206;
 names.forEach((name,i)=>{const a=i*45-21.4,b=i*45+21.4,o=polar(96,a),p=polar(96,b),q=polar(36,b),r=polar(36,a);const g=add('g',{'role':'button','tabindex':'0','aria-label':name+' facing','aria-pressed':'false','data-facing':name,'class':'compass-wedge'});add('path',{d:`M${o} A96 96 0 0 1 ${p} L${q} A36 36 0 0 0 ${r} Z`},g);const t=polar(66,i*45);const text=add('text',{x:t[0],y:t[1],'text-anchor':'middle','dominant-baseline':'central','font-size':i%2?13:16,'font-weight':i%2?600:700},g);text.textContent=labels[i];g.addEventListener('click',()=>{expand();selected=selected.includes(name)?selected.filter(x=>x!==name):[...selected,name];emit();});g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();g.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});});
 const center=add('g',{role:'button',tabindex:0,'aria-label':'Clear facing filter',class:'compass-center'});add('circle',{cx:100,cy:100,r:32},center);const title=add('text',{x:100,y:94,'text-anchor':'middle',class:'compass-center-title'},center),subtitle=add('text',{x:100,y:111,'text-anchor':'middle',class:'compass-center-subtitle'},center);
 add('path',{d:'M100 1 L96 9 L104 9 Z',fill:'#C62F2F','pointer-events':'none'});
 const render=()=>{svg.querySelectorAll('[data-facing]').forEach(g=>g.setAttribute('aria-pressed',String(selected.includes(g.dataset.facing))));title.textContent=selected.length?(count===0?'No plots':count):'All';subtitle.textContent=selected.length?(count===0?'facing '+selected.map(x=>labels[names.indexOf(x)]).join('+'):'plots'):total;center.setAttribute('aria-label',count===0&&selected.length?'No plots facing '+selected.join(', ')+'. Clear facing filter':'Clear facing filter');document.body.classList.toggle('compass-facing-active',selected.length>0);};
 const emit=()=>document.dispatchEvent(new CustomEvent('facing-selection-changed',{detail:{facings:selected}}));
 const expand=()=>{if(small.matches)card.classList.add('expanded');};
 const shrink=()=>{if(card.classList.contains('expanded')){card.classList.add('shrinking');card.classList.remove('expanded');setTimeout(()=>card.classList.remove('shrinking'),160);}};
 center.addEventListener('click',()=>{expand();selected=[];emit();});center.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();center.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 card.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();selected=[];emit();shrink();}});card.addEventListener('focusin',expand);card.addEventListener('click',expand);
 document.addEventListener('click',e=>{if(!card.contains(e.target))shrink();});
 document.addEventListener('plot-filters-changed',e=>{if(e.detail){selected=e.detail.facings;count=e.detail.count;total=e.detail.total;}render();});
 const place=()=>{const open=!legend.classList.contains('collapsed');card.hidden=small.matches&&open;card.style.bottom=(small.matches?76:legend.getBoundingClientRect().height+36)+'px';};
 new MutationObserver(()=>{place();document.dispatchEvent(new Event('map-chrome-resized'));}).observe(legend,{attributes:true,attributeFilter:['class']});
 let legendWidth=0;new ResizeObserver(()=>{place();const width=legend.getBoundingClientRect().width;if(Math.abs(width-legendWidth)>1){legendWidth=width;document.dispatchEvent(new Event('map-chrome-resized'));}}).observe(legend);small.addEventListener('change',()=>{card.classList.remove('expanded');place();});
 document.querySelector('.map-viewport').append(card);place();render();emit();
}

function compactMapCredits(node) {
 if(!node||node.dataset.creditsReady)return;node.dataset.creditsReady='true';node.classList.add('compact-map-credits');
 const observer=new MutationObserver(build);
 function build(){if(node.querySelector('.credits-disclosure'))return;observer.disconnect();const content=document.createElement('div');content.className='credits-content';while(node.firstChild)content.append(node.firstChild);const details=document.createElement('details');details.className='credits-disclosure';const summary=document.createElement('summary');summary.setAttribute('aria-label','Map credits');summary.title='Map credits';summary.innerHTML='<i class="fa-solid fa-circle-info" aria-hidden="true"></i>';details.append(summary,content);node.append(details);observer.observe(node,{childList:true});}
 build();node.addEventListener('keydown',e=>{if(e.key==='Escape'){node.querySelector('details').open=false;node.classList.add('credits-dismissed');}});node.addEventListener('click',()=>node.classList.remove('credits-dismissed'));node.addEventListener('pointerleave',()=>node.classList.remove('credits-dismissed'));
}
document.addEventListener('DOMContentLoaded',()=>{compactMapCredits(document.querySelector('.model-attribution'));const watch=new MutationObserver(()=>compactMapCredits(document.querySelector('.leaflet-control-attribution')));watch.observe(document.getElementById('leafletMapContainer'),{childList:true,subtree:true});});

document.addEventListener('DOMContentLoaded',()=>{const toast=document.getElementById('finderResultBanner');let shown=false;const sync=()=>{const next=toast.style.display!=='none';if(next===shown)return;shown=next;document.body.classList.toggle('finder-results-visible',shown);document.dispatchEvent(new Event('map-chrome-resized'));};new MutationObserver(sync).observe(toast,{attributes:true,attributeFilter:['style']});sync();});
