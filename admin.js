import {
  watchAuth, signIn, signOut, watchConfig, setOpen,
  watchParticipants, watchWinners, addWinner, setDiscarded, resetWinners
} from "./data.js";
import { ADMIN_EMAIL, DEMO, TOTAL_PREMIOS, PREMIO } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const POINTER = Math.PI * 1.5; // arriba (12 en punto)

// ------------------------------------------------------------ estado
let isOpen = null;
let participants = [];
let winners = [];
let wheelItems = [];
let rot = 0;
let spinning = false;
let started = false;
let streamMode = true;

// ------------------------------------------------------------ utilidades
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const maskEmail = (e) => { const [u, d] = String(e).split("@"); return (u || "").slice(0, 2) + "•••@" + (d || ""); };
const maskPhone = (p) => { const s = String(p); return s.slice(0, s.startsWith("+") ? 3 : 0) + " ••• ••• " + s.slice(-4); };
const contact = (x) => streamMode ? `${maskEmail(x.email)}` : `${x.email} · ${x.phone}`;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Entero aleatorio criptográficamente seguro en [0, n) sin sesgo */
function secureRandomInt(n) {
  const max = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= max);
  return buf[0] % n;
}

// ------------------------------------------------------------ acceso
if (DEMO) $("demoBadge").classList.remove("hidden");
$("prizeLabel").textContent = PREMIO;

watchAuth((user) => {
  if (!user) {
    $("gate").classList.remove("hidden"); $("app").classList.add("hidden");
    $("gateMsg").textContent = "Solo el administrador puede entrar.";
    $("loginBtn").classList.remove("hidden"); $("logoutGate").classList.add("hidden");
    return;
  }
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    $("gate").classList.remove("hidden"); $("app").classList.add("hidden");
    $("gateMsg").textContent = `La cuenta ${user.email} no tiene acceso a este panel.`;
    $("loginBtn").classList.add("hidden"); $("logoutGate").classList.remove("hidden");
    return;
  }
  $("gate").classList.add("hidden"); $("app").classList.remove("hidden");
  if (!started) { started = true; start(); }
});

$("loginBtn").onclick = () => signIn().catch((e) => { $("gateMsg").textContent = "No se pudo iniciar sesión: " + (e.code || e.message); });
$("logoutGate").onclick = () => signOut();
$("logoutBtn").onclick = () => signOut().then(() => location.reload());

// ------------------------------------------------------------ datos en vivo
function onErr(e) {
  $("hint").textContent = e && e.code === "permission-denied"
    ? "Permiso denegado: revisa que tu correo esté igual en firebase-config.js y en las reglas de Firestore."
    : "Error de conexión: " + (e && (e.code || e.message));
}

function start() {
  setupCanvas();
  watchConfig((c) => { isOpen = c.open; renderReg(); renderSpin(); }, onErr);
  watchParticipants((list) => { participants = list; refresh(); }, onErr);
  watchWinners((list) => { winners = list; refresh(); }, onErr);
}

function refresh() {
  const won = new Set(winners.map((w) => w.id));
  const eligible = participants.filter((p) => !won.has(p.id));
  if (!spinning) {
    wheelItems = eligible.slice().sort((a, b) => hash(a.id) - hash(b.id));
    drawWheel();
  }
  $("count").textContent = participants.length;
  $("eligible").textContent = eligible.length;
  $("pCount").textContent = participants.length;
  renderWinners();
  renderList();
  renderSpin();
}

// ------------------------------------------------------------ registros abiertos / cerrados
function renderReg() {
  const b = $("regBtn");
  if (isOpen === null) return;
  $("regState").textContent = isOpen ? "Abiertos" : "Cerrados";
  $("regText").textContent = isOpen ? "Las personas se pueden registrar." : "Nadie más se puede registrar.";
  b.textContent = isOpen ? "Cerrar registros" : "Abrir registros";
  b.classList.toggle("close", isOpen);
}
$("regBtn").onclick = async () => {
  const b = $("regBtn");
  if (isOpen && !confirm("¿Cerrar los registros? Nadie más podrá inscribirse.")) return;
  b.disabled = true;
  try { await setOpen(!isOpen); } catch (e) { onErr(e); }
  b.disabled = false;
};

// ------------------------------------------------------------ listas
function renderWinners() {
  const ul = $("winners");
  const active = winners.filter((w) => !w.discarded).length;
  $("winCount").textContent = `${active} / ${TOTAL_PREMIOS}`;
  if (!winners.length) { ul.innerHTML = `<li class="empty">Aún no hay ganadores</li>`; return; }
  ul.innerHTML = winners.map((w) => {
    const wa = String(w.phone || "").replace(/\D/g, "");
    return `<li class="${w.discarded ? "discarded" : ""}">
      <div class="n">${w.order}</div>
      <div class="info"><b>${esc(w.name)}</b><span>${esc(w.discarded ? "Descartado · " : "")}${esc(contact(w))}</span></div>
      <div class="acts">
        ${streamMode ? "" : `<a class="mini" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`}
        <button class="mini" data-discard="${esc(w.id)}">${w.discarded ? "Restaurar" : "Descartar"}</button>
      </div>
    </li>`;
  }).join("");
}
$("winners").addEventListener("click", async (e) => {
  const id = e.target.closest("[data-discard]")?.dataset.discard;
  if (!id) return;
  const w = winners.find((x) => x.id === id);
  if (!w) return;
  if (!w.discarded && !confirm(`¿Descartar a ${w.name}? (por ejemplo, si no responde). No vuelve a la ruleta y el premio queda libre para otro giro.`)) return;
  try { await setDiscarded(id, !w.discarded); } catch (err) { onErr(err); }
});

function renderList() {
  const q = $("search").value.trim().toLowerCase();
  const won = new Map(winners.map((w) => [w.id, w]));
  const rows = participants.filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.includes(q));
  $("plist").innerHTML = rows.length
    ? rows.slice().reverse().map((p) => `<div class="${won.has(p.id) ? "won" : ""}"><b>${won.has(p.id) ? "★ " : ""}${esc(p.name)}</b><span>${esc(contact(p))}</span></div>`).join("")
    : `<div><span>Sin resultados</span></div>`;
}
$("search").oninput = renderList;

$("streamMode").onchange = (e) => { streamMode = e.target.checked; renderWinners(); renderList(); };

$("resetBtn").onclick = async () => {
  if (!winners.length) return;
  if (!confirm("¿Borrar TODOS los ganadores? Volverán a entrar en la ruleta.")) return;
  if (!confirm("Confirma de nuevo: esto no se puede deshacer.")) return;
  try { await resetWinners(winners.map((w) => w.id)); } catch (e) { onErr(e); }
};

$("csvBtn").onclick = () => {
  const won = new Map(winners.map((w) => [w.id, w]));
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Nombre", "Correo", "WhatsApp", "Fecha registro", "Ganador #", "Estado"].map(q).join(";")];
  participants.forEach((p) => {
    const w = won.get(p.id);
    lines.push([p.name, p.email, p.phone, new Date(p.createdAt).toLocaleString("es-CO"), w ? w.order : "", w ? (w.discarded ? "Descartado" : "Ganador") : ""].map(q).join(";"));
  });
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `participantes-sorteo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ------------------------------------------------------------ ruleta
const canvas = $("wheel");
const ctx = canvas.getContext("2d");
let S = 600, dpr = 1;
const logoImg = new Image();
logoImg.onload = () => drawWheel();
logoImg.src = "assets/logo.png";
const PALETTE = [
  { bg: "#ffffff", fg: "#000000" },
  { bg: "#0b0b0b", fg: "#ffffff" },
  { bg: "#bdbdbd", fg: "#000000" },
  { bg: "#1f1f1f", fg: "#ffffff" }
];

function setupCanvas() {
  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    S = canvas.clientWidth || 600;
    canvas.width = Math.round(S * dpr);
    canvas.height = Math.round(S * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWheel();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
}

function colorFor(i, n) {
  let k = i % PALETTE.length;
  if (n > 1 && i === n - 1 && k === 0) k = 2; // evita dos iguales juntos al cerrar el círculo
  return PALETTE[k];
}

function drawWheel() {
  const c = S / 2, r = c - 8;
  ctx.clearRect(0, 0, S, S);

  // aro exterior
  ctx.beginPath(); ctx.arc(c, c, r + 4, 0, TAU); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5; ctx.stroke();

  const n = wheelItems.length;
  if (!n) {
    ctx.beginPath(); ctx.arc(c, c, r, 0, TAU); ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#8a8a8a"; ctx.font = `600 ${Math.max(12, S / 34)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("ESPERANDO PARTICIPANTES", c, c);
    return;
  }

  const a = TAU / n;
  const showLabels = n <= 70;
  const fs = Math.max(9, Math.min(18, r * a * 0.55, S / 30));
  const maxChars = n > 40 ? 12 : 18;

  for (let i = 0; i < n; i++) {
    const col = colorFor(i, n);
    const s = rot + i * a;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, r, s, s + a); ctx.closePath();
    ctx.fillStyle = col.bg; ctx.fill();
    if (n > 1 && n <= 200) { ctx.strokeStyle = "rgba(128,128,128,.35)"; ctx.lineWidth = 1; ctx.stroke(); }

    if (showLabels) {
      ctx.save();
      ctx.translate(c, c); ctx.rotate(s + a / 2);
      ctx.fillStyle = col.fg; ctx.font = `600 ${fs}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      let t = wheelItems[i].name;
      if (t.length > maxChars) t = t.slice(0, maxChars - 1) + "…";
      ctx.fillText(t, r - 14, 0);
      ctx.restore();
    }
  }

  // centro
  ctx.beginPath(); ctx.arc(c, c, r * 0.16, 0, TAU); ctx.fillStyle = "#000"; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.stroke();
  if (logoImg.complete && logoImg.naturalWidth) {
    const lw = r * 0.2, lh = lw * logoImg.naturalHeight / logoImg.naturalWidth;
    ctx.drawImage(logoImg, c - lw / 2, c - lh / 2, lw, lh);
  } else {
    ctx.fillStyle = "#fff"; ctx.font = `700 ${r * 0.09}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("NQ", c, c + 1);
  }
}

function indexAtPointer() {
  const n = wheelItems.length; if (!n) return -1;
  const a = TAU / n;
  const rel = (((POINTER - rot) % TAU) + TAU) % TAU;
  return Math.floor(rel / a) % n;
}

// sonido de "tick"
let audio = null;
function tick() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = "square"; o.frequency.value = 1400;
    g.gain.setValueAtTime(0.04, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.04);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.05);
  } catch (_) {}
}

function spinTo(w) {
  return new Promise((resolve) => {
    const n = wheelItems.length, a = TAU / n;
    const jitter = (Math.random() - 0.5) * 0.7 * a;
    const base = POINTER - (w + 0.5) * a + jitter;
    const delta = (((base - rot) % TAU) + TAU) % TAU;
    const from = rot, to = rot + 8 * TAU + delta;
    const dur = 8500, t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    let last = -1, lastTick = 0;
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      rot = from + (to - from) * ease(t);
      drawWheel();
      const idx = indexAtPointer();
      if (idx !== last) {
        last = idx;
        $("ticker").textContent = wheelItems[idx]?.name ?? "";
        if (now - lastTick > 45) { tick(); lastTick = now; }
      }
      if (t < 1) requestAnimationFrame(frame);
      else { rot = rot % TAU; resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

function renderSpin() {
  const btn = $("spinBtn");
  const n = wheelItems.length;
  let hint = "";
  if (isOpen) hint = "Cierra los registros para poder girar.";
  else if (!n) hint = "No hay participantes disponibles en la ruleta.";
  btn.disabled = spinning || isOpen !== false || !n;
  if (!spinning) $("hint").textContent = hint;
}

$("spinBtn").onclick = async () => {
  if (spinning || isOpen !== false || !wheelItems.length) return;
  const active = winners.filter((w) => !w.discarded).length;
  if (active >= TOTAL_PREMIOS && !confirm(`Ya hay ${TOTAL_PREMIOS} ganadores. ¿Girar de todas formas?`)) return;

  spinning = true; renderSpin();
  $("hint").textContent = "Girando…";
  const w = secureRandomInt(wheelItems.length);
  const winner = wheelItems[w];
  const order = winners.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;

  await spinTo(w);

  $("ticker").textContent = winner.name;
  let saved = true;
  try { await addWinner(winner, order); } catch (e) { saved = false; onErr(e); }

  const prizeN = active + 1;
  $("mTag").textContent = `Ganador #${prizeN} · ${PREMIO}`;
  $("mName").textContent = winner.name;
  $("mSub").textContent = saved ? contact(winner) : "⚠️ No se pudo guardar. Revisa la conexión y anótalo.";
  $("modal").classList.remove("hidden");
  if (window.confetti) {
    const fire = (x) => window.confetti({ particleCount: 140, spread: 80, startVelocity: 55, origin: { x, y: 0.7 }, colors: ["#ffffff", "#bdbdbd", "#6b6b6b"] });
    fire(0.25); fire(0.75); setTimeout(() => fire(0.5), 250);
  }

  spinning = false;
  refresh();
};

$("mClose").onclick = () => $("modal").classList.add("hidden");
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("modal").classList.add("hidden"); });
