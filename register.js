import { watchConfig, register } from "./data.js";
import { DEMO, TOTAL_PREMIOS } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const form = $("form"), msg = $("msg"), btn = $("submit");
let isOpen = null;
let registered = false;
try { registered = localStorage.getItem("nq_sorteo_registrado") === "1"; } catch (_) {}

$("nPremios").textContent = TOTAL_PREMIOS;
if (DEMO) $("demoBadge").classList.remove("hidden");

function render() {
  const st = $("status");
  st.className = "status" + (isOpen === true ? " open" : isOpen === false ? " closed" : "");
  st.querySelector("span").textContent =
    isOpen === null ? "Conectando…" : isOpen ? "Registros abiertos" : "Registros cerrados";

  form.classList.toggle("hidden", registered || isOpen === false);
  $("done").classList.toggle("hidden", !registered);
  $("closed").classList.toggle("hidden", registered || isOpen !== false);
  btn.disabled = isOpen !== true;
}

watchConfig((c) => { isOpen = c.open; render(); }, () => {
  msg.className = "msg err";
  msg.textContent = "No pudimos conectar. Recarga la página.";
});
render();

const cleanName = (s) => s.replace(/\s+/g, " ").trim().slice(0, 60);
const cleanEmail = (s) => s.trim().toLowerCase();
const cleanPhone = (s) => {
  const t = s.trim();
  const digits = t.replace(/\D/g, "");
  return (t.startsWith("+") ? "+" : "") + digits;
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.className = "msg"; msg.textContent = "";

  const name = cleanName($("name").value);
  const email = cleanEmail($("email").value);
  const phone = cleanPhone($("phone").value);

  // Anti-bots: si el campo oculto viene lleno, fingimos éxito
  if ($("website").value) { registered = true; render(); return; }

  const err = (t) => { msg.className = "msg err"; msg.textContent = t; };
  if (name.length < 3) return err("Escribe tu nombre completo.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return err("Revisa tu correo electrónico.");
  if (!/^\+?[0-9]{7,16}$/.test(phone)) return err("Escribe tu WhatsApp con indicativo, solo números. Ej: +57 300 123 4567");
  if (!$("consent").checked) return err("Debes aceptar el uso de tus datos para participar.");
  if (isOpen !== true) return err("Los registros están cerrados.");

  btn.disabled = true;
  btn.textContent = "Registrando…";
  try {
    await register({ name, email, phone });
    registered = true;
    try { localStorage.setItem("nq_sorteo_registrado", "1"); } catch (_) {}
    render();
  } catch (ex) {
    if (ex && ex.message === "denied") {
      err(isOpen ? "Este correo ya está registrado. Solo se permite un registro por persona." : "Los registros ya se cerraron.");
    } else {
      err("Hubo un problema de conexión. Intenta de nuevo.");
    }
  } finally {
    btn.textContent = "Quiero participar";
    btn.disabled = isOpen !== true;
  }
});
