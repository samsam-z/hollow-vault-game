// Hollow Vault renderer. Everything is drawn in the fixed 1280x720 logical field; the canvas is
// letterboxed to the window so the art never stretches. All visuals are generated (no image,
// font, or sound file): neon geometry, bloom via shadowBlur, particles and a readable HUD.
import { CHARGE, COMBO, ENEMY, FIELD, PALETTE, FONT, TURRET, VAULT } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const TAU = Math.PI * 2;
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glow(ctx, color, blur, draw) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = 0, vh = 0, scale = 1, ox = 0, oy = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    scale = Math.min(vw / FIELD.width, vh / FIELD.height);
    ox = (vw - FIELD.width * scale) / 2;
    oy = (vh - FIELD.height * scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  function begin(shake) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#04060f';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.translate(ox + sx, oy + sy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, FIELD.width, FIELD.height);
    ctx.clip();
  }
  function end() { ctx.restore(); }

  function background(s) {
    const g = ctx.createRadialGradient(FIELD.cx, FIELD.cy, 40, FIELD.cx, FIELD.cy, 720);
    g.addColorStop(0, PALETTE.space2);
    g.addColorStop(1, PALETTE.space);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Faint concentric grid gives motion a sense of scale.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let r = 120; r <= 600; r += 120) {
      ctx.beginPath();
      ctx.arc(FIELD.cx, FIELD.cy, r, 0, TAU);
      ctx.stroke();
    }
    for (let a = 0; a < TAU; a += Math.PI / 12) {
      ctx.beginPath();
      ctx.moveTo(FIELD.cx + Math.cos(a) * 110, FIELD.cy + Math.sin(a) * 110);
      ctx.lineTo(FIELD.cx + Math.cos(a) * 620, FIELD.cy + Math.sin(a) * 620);
      ctx.stroke();
    }
  }

  function vault(s) {
    const v = s.vault;
    const cx = FIELD.cx, cy = FIELD.cy;
    // Shield ring: one arc lit per remaining pip.
    ctx.lineWidth = 6;
    for (let i = 0; i < VAULT.shields; i += 1) {
      const a0 = -Math.PI / 2 + i * TAU / VAULT.shields + 0.06;
      const a1 = -Math.PI / 2 + (i + 1) * TAU / VAULT.shields - 0.06;
      const lit = i < v.shields;
      ctx.strokeStyle = lit ? PALETTE.shield : 'rgba(120,150,190,0.12)';
      glow(ctx, lit ? PALETTE.shield : 'transparent', lit ? 14 : 0, () => {
        ctx.beginPath();
        ctx.arc(cx, cy, VAULT.radius + 16, a0, a1);
        ctx.stroke();
      });
    }
    // Core body.
    const flash = v.flash;
    glow(ctx, flash > 0 ? '#ff5d73' : PALETTE.vault, 24 + flash * 22, () => {
      ctx.fillStyle = flash > 0 ? 'rgba(255,93,115,0.35)' : PALETTE.vaultGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, VAULT.radius + 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = flash > 0 ? '#ffd9df' : PALETTE.vaultCore;
      ctx.beginPath();
      ctx.arc(cx, cy, VAULT.radius - 8, 0, TAU);
      ctx.fill();
    });
    // Rotating inner rune.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.time * 0.4);
    ctx.strokeStyle = PALETTE.vault;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = i / 6 * TAU;
      ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
      ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30);
    }
    ctx.stroke();
    ctx.restore();
  }

  function turret(s) {
    const t = s.turret;
    const px = FIELD.cx + Math.cos(t.angle) * t.orbit;
    const py = FIELD.cy + Math.sin(t.angle) * t.orbit;
    // Orbit arm.
    ctx.strokeStyle = 'rgba(120,180,220,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(FIELD.cx, FIELD.cy);
    ctx.lineTo(px, py);
    ctx.stroke();
    // Charge halo while holding fire.
    if (t.charge > 0) {
      const full = t.charge >= CHARGE.fullSeconds - 0.001;
      ctx.strokeStyle = full ? '#fff3b0' : 'rgba(143,246,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, TURRET.radius + 8, -Math.PI / 2, -Math.PI / 2 + TAU * (t.charge / CHARGE.fullSeconds));
      ctx.stroke();
    }
    glow(ctx, PALETTE.turret, 16, () => {
      ctx.fillStyle = PALETTE.turret;
      ctx.beginPath();
      ctx.arc(px, py, TURRET.radius - t.recoil * 2, 0, TAU);
      ctx.fill();
    });
    // Barrel points along aim.
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(t.aim);
    ctx.fillStyle = PALETTE.bolt;
    ctx.fillRect(TURRET.radius - 4, -4, 22 - t.recoil * 5, 8);
    ctx.restore();
  }

  function enemyShape(e) {
    const r = e.radius;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    const flash = e.hitFlash;
    const color = flash > 0 ? '#ffffff'
      : e.kind === 'runner' ? PALETTE.runner
      : e.kind === 'splitter' ? PALETTE.splitter
      : e.kind === 'shield' ? PALETTE.shieldEnemy
      : e.kind === 'drifter' ? PALETTE.drifter
      : PALETTE.boss;
    glow(ctx, color, 12, () => {
      ctx.strokeStyle = color;
      ctx.fillStyle = 'rgba(8,11,24,0.85)';
      ctx.lineWidth = 2.4;
      if (e.kind === 'runner') {
        ctx.beginPath();
        ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.8); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.8, -r * 0.8);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (e.kind === 'splitter') {
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) { const a = i / 6 * TAU; const p = i ? 'lineTo' : 'moveTo'; ctx[p](Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5); ctx.stroke();
      } else if (e.kind === 'shield') {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.stroke();
        // Front shield arc faces away from the vault.
        ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 5;
        const facing = Math.atan2(e.y - FIELD.cy, e.x - FIELD.cx) + Math.PI - e.rot;
        ctx.beginPath(); ctx.arc(0, 0, r + 6, facing - e.frontArc, facing + e.frontArc); ctx.stroke();
      } else if (e.kind === 'drifter') {
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 12; i += 1) { const a = i / 12 * TAU; const rr = i % 2 ? r * 0.72 : r; const p = i ? 'lineTo' : 'moveTo'; ctx[p](Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.stroke();
      }
    });
    ctx.restore();
    // HP bar for tough enemies.
    if (e.maxHp > 2 && e.active) {
      const w = r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - r, e.y - r - 12, w, 4);
      ctx.fillStyle = color;
      ctx.fillRect(e.x - r, e.y - r - 12, w * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
  }

  function boltsAndFx(s) {
    for (const b of s.bolts) {
      for (let i = 0; i < b.trail.length; i += 1) {
        const p = b.trail[i];
        ctx.fillStyle = b.heavy ? `rgba(255,243,176,${0.1 + i * 0.07})` : `rgba(143,246,255,${0.08 + i * 0.06})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, b.radius * (0.4 + i * 0.12), 0, TAU); ctx.fill();
      }
      glow(ctx, b.heavy ? PALETTE.heavyBolt : PALETTE.bolt, 16, () => {
        ctx.fillStyle = b.heavy ? PALETTE.heavyBolt : PALETTE.bolt;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, TAU); ctx.fill();
      });
    }
    for (const p of s.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of s.rings) {
      ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function hud(s, best) {
    ctx.textBaseline = 'top';
    // Top-left score / combo.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('SCORE', 26, 22);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(String(s.score).padStart(6, '0'), 26, 38);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText(`BEST ${best}`, 26, 78);
    if (s.combo > 1) {
      ctx.fillStyle = PALETTE.good;
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText(`x${s.combo} COMBO`, 26, 100);
    }

    // Top-right wave and shields.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('WAVE', FIELD.width - 26, 22);
    ctx.fillStyle = PALETTE.vault;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(`${s.wave} / ${12}`, FIELD.width - 26, 38);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 12px ${FONT}`;
    const remaining = s.spawnLeft + s.enemies.filter((e) => e.active).length;
    ctx.fillText(`${remaining} hostiles`, FIELD.width - 26, 74);
    ctx.textAlign = 'left';

    // Bottom-centre energy meter.
    const bw = 300, bx = FIELD.cx - bw / 2, by = FIELD.height - 42;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundedRect(ctx, bx, by, bw, 12, 6); ctx.fill();
    const full = s.energy >= CHARGE.novaCost - 0.001;
    ctx.fillStyle = full ? '#eafcff' : PALETTE.vault;
    glow(ctx, full ? '#eafcff' : PALETTE.vault, full ? 16 : 6, () => {
      roundedRect(ctx, bx, by, bw * clamp(s.energy, 0, 1), 12, 6); ctx.fill();
    });
    ctx.fillStyle = full ? PALETTE.text : PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(full ? 'NOVA READY — press E / right click' : 'CHARGING NOVA — keep comboing', FIELD.cx, by - 20);
    ctx.textAlign = 'left';

    // Bottom-left controls hint.
    ctx.fillStyle = PALETTE.dim;
    ctx.font = `500 11px ${FONT}`;
    ctx.fillText('A/D or ←/→ orbit  ·  mouse aim  ·  hold SPACE / click to charge  ·  E nova  ·  P pause', 26, FIELD.height - 26);
  }

  function shieldPips(s) {
    const cx = FIELD.cx, cy = FIELD.cy - VAULT.radius - 40;
    for (let i = 0; i < VAULT.shields; i += 1) {
      const x = cx + (i - (VAULT.shields - 1) / 2) * 22;
      ctx.fillStyle = i < s.vault.shields ? PALETTE.shield : 'rgba(120,150,190,0.15)';
      ctx.beginPath(); ctx.arc(x, cy, 6, 0, TAU); ctx.fill();
    }
  }

  function centerPanel(title, lines, accent) {
    ctx.fillStyle = 'rgba(4,7,16,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const w = 640, h = 300, x = FIELD.cx - w / 2, y = FIELD.cy - h / 2;
    ctx.fillStyle = PALETTE.panel;
    roundedRect(ctx, x, y, w, h, 18); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText(title, FIELD.cx, y + 36);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 16px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, FIELD.cx, y + 112 + i * 30));
    ctx.textAlign = 'left';
  }

  function draw(s, screen, best) {
    begin(s.shake);
    background(s);
    for (const e of s.enemies) if (e.active) enemyShape(e);
    vault(s);
    turret(s);
    boltsAndFx(s);
    shieldPips(s);
    hud(s, best);

    if (s.novaFlash > 0) {
      ctx.fillStyle = `rgba(234,252,255,${s.novaFlash * 0.35})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_TITLE) {
      centerPanel('HOLLOW VAULT', [
        'Defend the core. Orbit, aim, and fire at the intruders.',
        'Runners rush · Splitters break apart · Shields block your front shots',
        'Drifters weave · Every 5th wave brings a boss',
        'Hold SPACE / click to charge · press E for a full-meter nova',
        'Press ENTER or click to begin',
      ], PALETTE.vault);
    } else if (screen === SCREEN_PAUSED) {
      centerPanel('PAUSED', ['Press P or Esc to resume.'], PALETTE.shield);
    } else if (screen === SCREEN_OVER) {
      centerPanel('VAULT FALLEN', [
        `Score ${s.score}   ·   Wave ${s.wave}   ·   Best combo x${s.bestCombo}`,
        `Kills ${s.kills}   ·   Best ${best}`,
        'Press ENTER or click to rebuild the vault and try again',
      ], PALETTE.runner);
    }
    end();
  }

  return { draw, resize };
}
