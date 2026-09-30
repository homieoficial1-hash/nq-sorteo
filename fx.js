// Partículas ambientales (mismo efecto de la página principal)
(function () {
  const c = document.getElementById("fx");
  if (!c) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = c.getContext("2d");
  let w = 0, h = 0, parts = [];
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function init() {
    const n = Math.max(55, Math.min(140, Math.round((w * h) / 6500)));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5 + 0.5,
      vy: -(Math.random() * 0.16 + 0.04), vx: (Math.random() - 0.5) * 0.1,
      a: Math.random() * 0.32 + 0.08, tw: Math.random() * Math.PI * 2
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y += p.vy; p.x += p.vx; p.tw += 0.018;
      if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
      if (p.x < -6) p.x = w + 6; if (p.x > w + 6) p.x = -6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fillStyle = "rgba(255,255,255," + p.a * (0.6 + 0.4 * Math.sin(p.tw)) + ")"; ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  size(); init();
  window.addEventListener("resize", () => { size(); init(); });
  requestAnimationFrame(tick);
})();
