// RDS adaptation: label the provenance we have; never invent verification or an advisor.
function setupRds() {
    const form = document.getElementById('siteVisitForm');
    if (form) {
        const submit = form.querySelector('button[type="submit"]');
        const consent = document.createElement('div'); consent.className = 'rt-consent';
        consent.innerHTML = '<input type="checkbox" id="visitShareConsent" required><label for="visitShareConsent">I agree to share these visit details and my phone number with Aspirealty sales through WhatsApp. I will review and send the message myself.</label>';
        if (submit) form.insertBefore(consent, submit);
        const pickup = document.getElementById('visitCabPickup'); if (pickup) pickup.checked = false;
        const note = document.createElement('p'); note.className = 'rt-provenance';
        note.textContent = 'A visit is confirmed only after the sales team responds. Your details are not sent until you send the WhatsApp message.';
        if (submit) submit.before(note);
    }
    const legend = document.getElementById('floatingLegendCard'); if (legend) legend.classList.add('collapsed');
    const layerHeader = document.querySelector('.layer-control-header');
    if (layerHeader) {
        const panel = layerHeader.parentElement;
        panel.classList.add('rt-layers-collapsed');
        layerHeader.setAttribute('role', 'button'); layerHeader.setAttribute('tabindex','0'); layerHeader.setAttribute('aria-expanded','false');
        const toggle = () => { const collapsed = panel.classList.toggle('rt-layers-collapsed'); layerHeader.setAttribute('aria-expanded',String(!collapsed)); };
        layerHeader.addEventListener('click', toggle);
        layerHeader.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    }
    document.querySelector('.approved-badge')?.remove();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',setupRds); else setupRds();

function setupLayoutWorkspace() {
    const compactNav=matchMedia('(max-width:600px)');
    const updateNav=()=>{ ['btnSchematicView','btnSatelliteView','btn3DView'].forEach((id,index)=>{const button=document.getElementById(id); button.setAttribute('aria-label',['Schematic View','Satellite View','3D View'][index]); button.querySelector('span').textContent=(compactNav.matches?['Schematic','Satellite','3D']:['Schematic View','Satellite View','3D View'])[index]; }); };
    compactNav.addEventListener('change',updateNav); updateNav();
    const host = document.getElementById('threeMapContainer');
    const panel = host.querySelector('.modal-3d-header');
    panel.id = 'threeOptionsPanel';
    panel.hidden = true;
    panel.querySelector('.modal-3d-title').textContent = 'View options';
    const bar = document.createElement('div'); bar.className = 'rt-three-bar';
    bar.innerHTML = '<button id="threeOptionsToggle" aria-expanded="false" aria-controls="threeOptionsPanel">View options</button><button id="threePlanShortcut">Top view</button>';
    host.appendChild(bar);
    bar.appendChild(host.querySelector('.three-hud-search'));
    document.getElementById('plotSearchInput').setAttribute('aria-label','Find plot in 3D');
    document.getElementById('plotSearchInput').placeholder='Plot no.';
    panel.appendChild(host.querySelector('.three-hud-filters'));
    const toggle = bar.querySelector('#threeOptionsToggle');
    toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); });
    bar.querySelector('#threePlanShortcut').addEventListener('click', () => panel.querySelector('[data-preset="topDown"]').click());
    panel.querySelectorAll('.btn-light-mode').forEach(button => button.parentElement.hidden = true);
    const sun = document.createElement('section'); sun.className = 'rt-sun-controls';
    sun.innerHTML = '<h4>Sun & shadows</h4><label for="sunDate">Date</label><input type="date" id="sunDate"><label for="sunHour">Time (IST) <output id="sunTime">12:00</output></label><input type="range" id="sunHour" min="6" max="18" step="0.25" value="12"><button type="button" id="sunPlay">Play daylight</button><p id="sunPosition" aria-live="polite"></p><p>Estimated sunlight at the project location. Buildings and shadows are illustrative, not a site survey.</p>';
    sun.hidden = true; host.appendChild(sun);
    const sunToggle = document.createElement('button'); sunToggle.className='toolbar-btn rt-sun-toggle'; sunToggle.textContent='Show sun & shadows';
    panel.appendChild(sunToggle);
    sunToggle.addEventListener('click', () => { sun.hidden=!sun.hidden; host.classList.toggle('rt-sun-open',!sun.hidden && !desktop.matches); sunToggle.textContent=sun.hidden?'Show sun & shadows':'Hide sun & shadows'; if(!sun.hidden) updateSun(); else { stop(); window.disableAvatar3Sun?.(); } panel.hidden= !desktop.matches; toggle.setAttribute('aria-expanded','false'); });
    const sunClose=document.createElement('button'); sunClose.className='rt-sun-close'; sunClose.textContent='Close'; sunClose.setAttribute('aria-label','Close sun controls');
    sun.querySelector('h4').appendChild(sunClose); sunClose.addEventListener('click',()=>{sun.hidden=true;if(host.classList.contains('rt-sun-open')) host.classList.remove('rt-sun-open');});
    sun.querySelector('#sunDate').value = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'});
    const updateSun = () => {
        const hour = Number(sun.querySelector('#sunHour').value);
        sun.querySelector('#sunTime').textContent = `${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.round((hour%1)*60)).padStart(2,'0')}`;
        const result = window.setAvatar3Sun?.(sun.querySelector('#sunDate').value, hour);
        if (result) sun.querySelector('#sunPosition').textContent = result.elevation > 0 ? `Sun elevation ${result.elevation.toFixed(0)}° · Bearing ${result.azimuth.toFixed(0)}° from north` : 'Sun below the horizon';
    };
    sun.querySelector('#sunHour').addEventListener('input', updateSun);
    sun.querySelector('#sunDate').addEventListener('change', updateSun);
    let playback;
    const stop = () => { clearInterval(playback); playback = null; sun.querySelector('#sunPlay').textContent = 'Play daylight'; };
    sun.querySelector('#sunPlay').addEventListener('click', () => {
        if (playback) return stop();
        sun.querySelector('#sunPlay').textContent = 'Pause daylight';
        playback = setInterval(() => { const input = sun.querySelector('#sunHour'); input.value = Number(input.value) >= 18 ? 6 : Number(input.value)+0.25; updateSun(); }, 500);
    });
    const desktop=matchMedia('(min-width:993px)');
    const search=bar.querySelector('.three-hud-search');
    const sidebarContent=document.querySelector('.sidebar-content');
    panel.classList.add('rt-desktop-tools');
    const arrange = active => {
        if(desktop.matches && active) {
            sidebarContent.appendChild(panel); panel.hidden=false;
            panel.querySelector('.modal-3d-title').textContent='3D tools';
            panel.querySelector('.modal-3d-title-group').after(search);
            panel.appendChild(sun);
            if(host.classList.contains('rt-sun-open')) host.classList.remove('rt-sun-open');
        } else {
            host.appendChild(panel); bar.appendChild(search); host.appendChild(sun);
            panel.hidden=true; sun.hidden=true; panel.querySelector('.modal-3d-title').textContent='View options';
        }
    };
    desktop.addEventListener('change',()=>arrange(document.body.classList.contains('rt-three-active')));
    const sync = () => {
        const active = getComputedStyle(host).display !== 'none';
        const changed=document.body.classList.contains('rt-three-active')!==active;
        document.body.classList.toggle('rt-three-active', active);
        if(changed) arrange(active);
        if (!active) { stop(); sun.hidden=true; window.disableAvatar3Sun?.(); if(host.classList.contains('rt-sun-open')) host.classList.remove('rt-sun-open'); }
    };
    new MutationObserver(sync).observe(host, {attributes:true,attributeFilter:['style','class']});
    host.addEventListener('keydown', e => { if(e.key === 'Escape') { panel.hidden=true; toggle.setAttribute('aria-expanded','false'); } });
    const finder=document.createElement('button'); finder.className='rt-mobile-finder'; finder.textContent='Find plots'; finder.setAttribute('aria-label','Smart Plot Finder'); finder.title='Smart Plot Finder'; finder.onclick=()=>document.getElementById('openPlotFinderSidebarBtn').click(); document.body.appendChild(finder);
    sync();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',setupLayoutWorkspace); else setupLayoutWorkspace();