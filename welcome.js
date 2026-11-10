/* ---------- Guidad start: första gången appen öppnas ----------
   Fem korta steg – namn, värld, följeslagare, vad man kan göra och två bra saker att slå på.
   Allt kan hoppas över och ändras senare. Visas igen via ⚙️ → "Visa introduktionen". */
const WELCOME = (() => {
  const STEPS = 5;
  let step = 0, el = null;
  const seen = () => lsGet('onboarded') === '1';
  // Visa bara för den som är helt ny – inte för den som redan har spelat, och inte mitt i en inbjudan
  function fresh() {
    if (BOT || seen()) return false;
    if (/invite=|^#[A-Z0-9]{4}$/i.test(location.hash || '')) return false;
    for (const k of ['ry_name', 'style', 'mood', 'mood_hist', 'bk_last', 'ry_stats']) if (lsGet(k)) return false;
    try { const g = JSON.parse(lsGet('ry_games') || 'null'); if (g && Object.keys(g).length) return false; } catch (e) {}   // listan skapas tom vid start
    try { const a = JSON.parse(lsGet('aq') || 'null'); if (a && a.days && a.days.length) return false; } catch (e) {}   // akvariet skapas tomt vid första start
    return true;
  }
  const dots = () => `<div class="ob-dots">${Array.from({ length: STEPS }, (_, i) => `<i class="${i === step ? 'on' : i < step ? 'done' : ''}"></i>`).join('')}</div>`;
  function card() {
    const W = STYLE.WORLDS, s = STYLE.get(), name = lsGet('ry_name') || '';
    let aqName = 'Stella'; try { aqName = TODAY.AQ._get().name; } catch (e) {}
    const nav = (next, label) => `<div class="ob-nav">${step ? '<button class="ob-back" data-act="obback">‹ Tillbaka</button>' : '<span></span>'}<button class="ob-next" data-act="${next || 'obnext'}">${label || 'Nästa ›'}</button></div>`;
    switch (step) {
      case 0: return `<div class="ob-hero">${typeof DOLPHIN === 'function' ? DOLPHIN('ob') : '🐬'}</div>
        <h1>Hej och välkommen!</h1><p>Det här är din egen spelplats – med spel, kompisar, en delfin som väntar på dig och lugn när du behöver det.</p>
        <label class="ob-lbl">Vad ska vi kalla dig?</label><input id="obName" maxlength="16" autocomplete="given-name" placeholder="Ditt namn" value="${esc(name)}">${nav('obname')}`;
      case 1: return `<h1>Välj din värld</h1><p>Det här blir din bakgrund och stämning. Du kan byta när du vill under ⚙️ → 🎨.</p>
        <div class="ob-worlds">${Object.entries(W).map(([k, w]) => `<button class="sty-w ${s.world === k ? 'on' : ''}" data-act="obworld" data-v="${k}" style="--a:${w.bg[0]};--b:${w.bg[1]};--c:${w.bg[2]};--g:${w.glow[0]};--t:${w.txt}"><i>${w.ic}</i><b>${w.name}</b></button>`).join('')}</div>${nav()}`;
      case 2: return `<div class="ob-hero">${typeof DOLPHIN === 'function' ? DOLPHIN('ob2', '#f9a8d4', '#a78bfa') : '🐬'}</div>
        <h1>Möt din följeslagare</h1><p>En stjärndelfin bor i ditt akvarium. Den växer för varje dag du tittar in, blir glad av mat och klappar – och den blir aldrig sjuk eller ledsen om du är borta ett tag.</p>
        <label class="ob-lbl">Vad ska delfinen heta?</label><input id="obAq" maxlength="16" value="${esc(aqName)}">${nav('obaq')}`;
      case 3: return `<h1>Det här kan du göra</h1>
        <ul class="ob-list">
          <li><i>🎲</i><b>Spela</b><span>Över 20 spel – själv, mot datorn eller med kompisar, på samma telefon eller på distans.</span></li>
          <li><i>☀️</i><b>Idag</b><span>Startsidan visar vad som väntar: din tur, nya meddelanden, dagens kod. Välj dagsform om du vill – eller dölj det.</span></li>
          <li><i>💬</i><b>Chatta och ring</b><span>Krypterat, bara med dem du känner. Logga in med din inbjudan för att hitta kompisarna.</span></li>
          <li><i>🛋️</i><b>Ta det lugnt</b><span>Akvariet och ljudlandskap med regn, hav eller brasa när du inte orkar spela.</span></li>
        </ul>${nav()}`;
      case 4: {
        const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
        return `<h1>Två bra saker</h1>
        <div class="ob-opt"><i>🔔</i><div><b>Notiser</b><span>Få veta när det är din tur, när någon skriver eller bjuder in. Du väljer vilka.</span></div>${perm === 'granted' ? '<em>✅ På</em>' : perm === 'denied' || perm === 'unsupported' ? '<em>–</em>' : '<button data-act="obnotify">Slå på</button>'}</div>
        <div class="ob-opt"><i>💾</i><div><b>Säkerhetskopia</b><span>Allt finns bara på den här enheten. En kopia gör att inget försvinner om telefonen gör det.</span></div><button data-act="obbackup">Senare</button></div>
        <p class="ob-small">Allt finns kvar under ⚙️ om du vill ändra något.</p>${nav('obdone', 'Nu kör vi! 🚀')}`;
      }
    }
    return '';
  }
  function draw() {
    if (!el) return;
    el.querySelector('.ob-card').innerHTML = dots() + card();
    const i = el.querySelector('input'); if (i) setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 120);
  }
  function open(again) {
    if (el) return; step = 0;
    el = document.createElement('div'); el.id = 'obWrap'; el.innerHTML = `<div class="ob-card"></div><button class="ob-skip" data-act="obskip">Hoppa över</button>`;
    document.body.appendChild(el); draw();
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const n = el.querySelector('.ob-next'); n && n.click(); } });
    if (!again) try { lsSet('ob_shown', String(Date.now())); } catch (e) {}
  }
  function close() { lsSet('onboarded', '1'); if (el) { el.classList.add('out'); const x = el; el = null; setTimeout(() => x.remove(), 350); } if (typeof render === 'function' && view === 'lobby') render(); }
  function act(a, b) {
    switch (a) {
      case 'obnext': step = Math.min(STEPS - 1, step + 1); draw(); return true;
      case 'obback': step = Math.max(0, step - 1); draw(); return true;
      case 'obname': { const v = ((el.querySelector('#obName') || {}).value || '').trim().slice(0, 16); if (v) lsSet('ry_name', v); step = 1; draw(); return true; }
      case 'obworld': STYLE.set('world', b.dataset.v); draw(); buzz(6); return true;
      case 'obaq': { const v = ((el.querySelector('#obAq') || {}).value || '').trim().slice(0, 16); try { if (v) { const a2 = TODAY.AQ._get(); a2.name = v; lsSet('aq', JSON.stringify(a2)); } } catch (e) {} step = 3; draw(); return true; }
      case 'obnotify': { try { Notification.requestPermission().then(() => { draw(); if (typeof pushSync === 'function') pushSync(true); }); } catch (e) {} return true; }
      case 'obbackup': toast('💾 Påminnelsen finns under Idag tills det är gjort', 3000); return true;
      case 'obskip': case 'obdone': close(); if (a === 'obdone') { try { celebrate('Välkommen! 🐬'); } catch (e) {} } return true;
      case 'obagain': closeModal(); open(true); return true;
    }
    return false;
  }
  // första starten: visa när allt har laddats
  document.addEventListener('DOMContentLoaded', () => { if (fresh()) setTimeout(() => open(false), 350); });
  return { open, close, act, fresh, seen };
})();
