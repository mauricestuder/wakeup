// First Chair: the build tools. Each one shows a preview on the mountain and asks for a
// Confirm tap before any money is spent.
import { THREE } from './view/scene.js';
import { ribbon } from './view/pistes.js';
import { T, LIFTS, BUILDINGS, DIFF } from './tuning.js';
import { checkLift, checkPiste, hintPisteStart, hintPisteEnd, hintLiftBottom, hintLiftTop } from './network.js';
import { checkBuilding, buildLift, buildPiste, buildBuilding, demolish } from './sim.js';
import { money } from './ui.js';

const GOOD = new THREE.Color(0x46c979), BAD = new THREE.Color(0xff6b5e);

export function createBuilder(ctx) {
  const { scene, ui, views, sfx } = ctx;
  const ghost = new THREE.Group();
  scene.add(ghost);
  const pinGeo = new THREE.CylinderGeometry(0.34, 0.05, 1.6, 10);
  const flat = (c, o = 0.9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, side: THREE.DoubleSide });
  let tool = null, A = null, B = null, wps = [], pos = null, hover = null, target = null, check = null;

  const state = () => ctx.state(), ter = () => ctx.ter();
  const afford = (cost) => state().sandbox || state().money >= cost;

  function pin(p, color) {
    const m = new THREE.Mesh(pinGeo, flat(color));
    m.position.set(p.x, ter().height(p.x, p.z) + 0.85, p.z);
    m.renderOrder = 20; m.userData.keepGeo = true;
    ghost.add(m);
  }
  function strip(pts, width, color, opacity = 0.75) {
    const m = new THREE.Mesh(ribbon(ter(), pts, width, 0.22, color, color), flat(0xffffff, opacity));
    m.material.vertexColors = true;
    m.renderOrder = 19;
    ghost.add(m);
  }
  function ring(x, z, r, color) {
    const pts = [];
    for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; pts.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r }); }
    strip(pts, 0.35, color, 0.8);
  }
  function wipe() {
    for (const c of [...ghost.children]) {
      ghost.remove(c);
      if (c.userData.own === false) continue; // a shared building model
      if (!c.userData.keepGeo) c.geometry.dispose();
      c.material.dispose();
    }
  }
  const line = (ok, text) => `<small class="${ok === true ? 'ok' : ok === false ? 'warn' : ''}">${ok === true ? '✓ ' : ok === false ? '⚠ ' : ''}${text}</small>`;

  function redraw() {
    wipe();
    check = null;
    if (!tool) { ui.setConfirm(ctx.idle()); return; }
    const s = state(), t = ter();
    let html = '', ok = false, label = 'Build', undo = false, red = false, noOk = false;

    if (tool.kind === 'lift') {
      const L = LIFTS[tool.type], top = B || (A && hover);
      if (!A) { html = `<b>${L.name}</b><small>Tap where the bottom station goes. Next to the car park is a good start.</small>`; noOk = true; if (hover) pin(hover, GOOD); }
      else if (!top) { html = `<b>${L.name}</b><small>Now tap where the top station goes, higher up the mountain.</small>`; noOk = true; pin(A, GOOD); }
      else {
        const c = checkLift(s, t, A, top, tool.type);
        const col = c.ok ? GOOD : BAD;
        pin(A, col); pin(top, col);
        strip(c.geo.pts.map((p) => ({ x: p.x, z: p.z })), 0.7, col);
        html = `<b>${L.name}</b> · ${Math.round(c.geo.d)} tiles · <b>${money(c.cost)}</b>`;
        if (!c.ok) html += `<small class="why">${c.why}</small>`;
        else {
          if (!afford(c.cost)) html += '<small class="why">Not enough money</small>';
          const hb = hintLiftBottom(s, t, A.x, A.z), ht = hintLiftTop(s, t, top.x, top.z);
          html += line(hb.ok, hb.text) + line(ht.ok, ht.text);
        }
        if (!B) html += '<small>Tap to set the top station.</small>';
        ok = !!B && c.ok && afford(c.cost);
        noOk = !B;
        check = c;
      }
    } else if (tool.kind === 'piste') {
      const pts = hover && wps.length ? [...wps, hover] : wps;
      if (!wps.length) { html = '<b>Piste</b><small>Tap where it starts: next to the top station of a lift.</small>'; noOk = true; if (hover) pin(hover, GOOD); }
      else if (pts.length < 2) {
        const h = hintPisteStart(s, t, wps[0].x, wps[0].z);
        html = '<b>Piste</b>' + line(h.ok, h.text) + '<small>Tap further downhill to add points.</small>';
        noOk = true; undo = true; pin(wps[0], GOOD);
      } else {
        const c = checkPiste(s, t, pts);
        const col = c.ok ? new THREE.Color(DIFF[c.geo.diff].color).lerp(new THREE.Color(0xffffff), c.geo.diff === 3 ? 0.25 : 0) : BAD;
        strip(c.geo.pts, T.PISTE_WIDTH, col, 0.8);
        for (const w of wps) pin(w, c.ok ? GOOD : BAD);
        const d = DIFF[c.geo.diff];
        html = `<b style="color:${c.geo.diff === 3 ? '#cfd6de' : d.css}">${d.name} piste</b> · ${Math.round(c.geo.len)} tiles · <b>${money(c.cost)}</b>`;
        if (!c.ok) html += `<small class="why">${c.why}</small>`;
        else {
          if (!afford(c.cost)) html += '<small class="why">Not enough money</small>';
          const e = pts[pts.length - 1], hs = hintPisteStart(s, t, pts[0].x, pts[0].z), he = hintPisteEnd(s, t, e.x, e.z);
          html += line(hs.ok, hs.text) + line(he.ok, he.text);
          if (c.trees.length) html += `<small>${c.trees.length} trees to clear</small>`;
        }
        undo = true;
        ok = wps.length >= 2 && c.ok && afford(c.cost);
        check = c;
      }
    } else if (tool.kind === 'building') {
      const Bd = BUILDINGS[tool.type], p = pos || hover;
      if (!p) { html = `<b>${Bd.name}</b> · <b>${money(Bd.cost)}</b><small>Tap where to put it. ${tool.type === 'hut' ? 'Next to a piste or a lift station, so guests can reach it.' : tool.type === 'cannon' ? 'Next to a piste: it covers 7 tiles around it.' : 'Flat ground works best.'}</small>`; noOk = true; }
      else {
        const c = checkBuilding(s, t, tool.type, p.x, p.z), col = c.ok ? GOOD : BAD;
        const m = views.buildings.mesh(tool.type);
        m.position.set(p.x, t.height(p.x, p.z), p.z);
        m.rotation.y = Math.atan2(t.base.x - p.x, t.base.z - p.z);
        m.userData.own = false; m.castShadow = false;
        ghost.add(m);
        ring(p.x, p.z, tool.type === 'cannon' ? T.CANNON_R : tool.type === 'hut' ? T.R_EXIT : 1.6, col);
        html = `<b>${Bd.name}</b> · <b>${money(c.cost)}</b>`;
        if (!c.ok) html += `<small class="why">${c.why}</small>`;
        else if (!afford(c.cost)) html += '<small class="why">Not enough money</small>';
        else if (tool.type === 'hut') {
          const reach = s.pistes.some((q) => q.pts.some((pt) => Math.hypot(pt.x - p.x, pt.z - p.z) <= T.R_EXIT))
            || s.lifts.some((l) => Math.hypot(l.a.x - p.x, l.a.z - p.z) <= T.R_WALK || Math.hypot(l.b.x - p.x, l.b.z - p.z) <= T.R_WALK)
            || Math.hypot(t.base.x - p.x, t.base.z - p.z) <= T.R_BASE;
          html += line(reach, reach ? 'Guests can reach it from here' : 'Too far from any piste or station: nobody would find it');
        }
        if (!pos) html += '<small>Tap to place it.</small>';
        ok = !!pos && c.ok && afford(c.cost);
        noOk = !pos;
        check = c;
      }
    } else if (tool.kind === 'remove') {
      label = 'Remove'; red = true;
      if (!target) { html = '<b>Remove</b><small>Tap a lift, a piste or a building.</small>'; noOk = true; }
      else {
        const it = target.item, name = target.kind === 'building' ? BUILDINGS[it.type].name : it.name;
        if (target.kind === 'piste') strip(it.pts, T.PISTE_WIDTH, BAD, 0.8);
        else if (target.kind === 'lift') { pin(it.a, BAD); pin(it.b, BAD); strip(it.pts.map((p) => ({ x: p.x, z: p.z })), 0.7, BAD); }
        else pin(it, BAD);
        html = `<b>Remove ${name}?</b><small>You get ${money(s.sandbox ? 0 : it.cost * T.REFUND)} back, half of what it cost.</small>`;
        ok = true;
      }
    }
    ui.setConfirm({ html, ok, label, undo, red, noOk, cancel: tool.kind === 'remove' && !target ? 'Done' : 'Cancel' });
  }

  function setTool(t) {
    tool = t; A = B = pos = hover = target = null; wps = [];
    ui.setTool(tool);
    redraw();
  }

  return {
    get tool() { return tool; },
    setTool, redraw,
    // A tap on the ground (p) while a tool is active. `picked` is whatever is under the finger.
    tap(p, picked) {
      if (!tool) return;
      hover = null;
      if (tool.kind === 'remove') {
        target = picked && ['lift', 'piste', 'building'].includes(picked.kind) ? picked : null;
        if (!target) sfx.buzz();
      } else if (!p) return;
      else if (tool.kind === 'lift') { if (!A) A = p; else B = p; }
      else if (tool.kind === 'piste') wps.push(p);
      else if (tool.kind === 'building') pos = p;
      sfx.tick();
      redraw();
    },
    hover(p) {
      if (!tool || tool.kind === 'remove') return;
      if (tool.kind === 'lift' && B) return;
      if (tool.kind === 'building' && pos) return;
      hover = p;
      redraw();
    },
    undo() {
      if (tool?.kind === 'piste' && wps.length) { wps.pop(); redraw(); }
    },
    cancel() {
      // First Cancel steps back, a second one puts the tool away.
      if (tool?.kind === 'lift' && (A || B)) { if (B) B = null; else A = null; redraw(); }
      else if (tool?.kind === 'piste' && wps.length) { wps = []; redraw(); }
      else if (tool?.kind === 'building' && pos) { pos = null; redraw(); }
      else if (tool?.kind === 'remove' && target) { target = null; redraw(); }
      else setTool(null);
    },
    confirm() {
      if (!tool) { ctx.idleConfirm(); return; }
      const s = state(), t = ter();
      let r = null;
      if (tool.kind === 'lift' && A && B) r = buildLift(s, t, tool.type, A, B);
      else if (tool.kind === 'piste' && wps.length >= 2) r = buildPiste(s, t, wps);
      else if (tool.kind === 'building' && pos) r = buildBuilding(s, t, tool.type, pos.x, pos.z);
      else if (tool.kind === 'remove' && target) {
        r = demolish(s, t, target.kind, target.item.id);
        if (r.ok) { sfx.remove(); if (r.refund) ui.toast(`Removed. ${money(r.refund)} back.`); target = null; redraw(); ctx.changed(); }
        return;
      }
      if (!r) return;
      if (!r.ok) { sfx.buzz(); ui.toast(r.why, 'bad'); return; }
      sfx.build();
      ui.toast(`Built for <b>${money(r.cost)}</b>`, 'good', 2200);
      ctx.changed(r.item);
      // Snow cannons usually come in rows, so that tool stays in hand. Everything else is put away.
      if (tool.kind === 'building' && tool.type === 'cannon') { pos = hover = null; redraw(); } else setTool(null);
    },
  };
}
