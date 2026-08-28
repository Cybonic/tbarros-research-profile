const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>!s||s==='unknown'?'TBD':new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
async function load(){
  try{
    const r=await fetch(`results.json?v=${Date.now()}`); if(!r.ok)throw Error(r.status);
    const d=await r.json(); document.querySelector('#timestamp').textContent=`Last scan: ${d.last_scan||'not available'}`;
    const rows=(d.positions||[]).filter(p=>p.relevant===true);
    document.querySelector('#positions').innerHTML=rows.length?rows.map(p=>`<tr><td>${esc(p.university)}</td><td><strong>${esc(p.title)}</strong>${p.department?`<br><span class="muted">${esc(p.department)}</span>`:''}</td><td>${date(p.deadline)}</td><td><a href="${esc(p.link)}" target="_blank" rel="noopener">Official notice →</a></td></tr>`).join(''):'<tr><td colspan="4" class="muted">No matching open positions found in the latest scan.</td></tr>';
    document.querySelector('#sources').innerHTML=Object.entries(d.scan_sources||{}).map(([s,v])=>`<li><strong>${esc(s)}</strong>: ${esc(v)}</li>`).join('')||'<li class="muted">No scan status available.</li>';
  }catch(e){document.querySelector('#positions').innerHTML='<tr><td colspan="4" class="muted">Radar data is temporarily unavailable.</td></tr>'}
}
document.addEventListener('DOMContentLoaded',load);
