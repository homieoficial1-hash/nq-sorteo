// Capa de datos: Firebase (real) o memoria (modo demo)
import { firebaseConfig, ADMIN_EMAIL, DEMO } from "./firebase-config.js";

const V = "10.12.2";
const toMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : Date.now());

// ---------------------------------------------------------------- Firebase
let fbPromise = null;
function fb() {
  if (!fbPromise) {
    fbPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`)
    ]).then(([appM, fs, au]) => {
      const app = appM.initializeApp(firebaseConfig);
      return { fs, au, db: fs.getFirestore(app), auth: au.getAuth(app) };
    });
  }
  return fbPromise;
}

// ---------------------------------------------------------------- Demo
const demo = { open: true, participants: [], winners: [], subs: { config: [], participants: [], winners: [] } };
if (DEMO) {
  const nombres = ["Andrés", "Camila", "Juan", "Valentina", "Santiago", "Laura", "Mateo", "Daniela", "Sebastián", "Mariana",
    "Felipe", "Sofía", "Carlos", "Isabella", "Diego", "Paula", "Alejandro", "Natalia", "Tomás", "Gabriela",
    "Nicolás", "Juliana", "David", "Manuela", "Samuel", "Luisa", "Emilio", "Sara", "Martín", "Ana"];
  const apellidos = ["Gómez", "Restrepo", "Martínez", "Rodríguez", "López", "Hernández", "Pérez", "Castro", "Vargas", "Ríos"];
  for (let i = 0; i < 48; i++) {
    const n = nombres[i % nombres.length], a = apellidos[(i * 7) % apellidos.length];
    const email = `${n}.${a}${i}@demo.com`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    demo.participants.push({ id: email, name: `${n} ${a}`, email, phone: "+57300" + String(1000000 + i * 3791).slice(0, 7), createdAt: Date.now() - (48 - i) * 60000 });
  }
}
const emit = (k) => {
  const val = k === "config" ? { open: demo.open } : [...demo[k]];
  demo.subs[k].forEach((cb) => cb(val));
};
const demoSub = (k, cb) => { demo.subs[k].push(cb); setTimeout(() => emit(k), 0); return () => {}; };

// ---------------------------------------------------------------- API
export function watchConfig(cb, onErr) {
  if (DEMO) return demoSub("config", cb);
  let unsub = () => {};
  fb().then(({ fs, db }) => {
    unsub = fs.onSnapshot(fs.doc(db, "config", "sorteo"),
      (s) => cb({ open: s.exists() && s.data().open === true }),
      (e) => onErr && onErr(e));
  }).catch((e) => onErr && onErr(e));
  return () => unsub();
}

/** Registra a un participante. Lanza Error("denied") si está cerrado o el correo ya existe. */
export async function register({ name, email, phone }) {
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 500));
    if (!demo.open || demo.participants.some((p) => p.id === email)) throw new Error("denied");
    demo.participants.push({ id: email, name, email, phone, createdAt: Date.now() });
    emit("participants");
    return;
  }
  const { fs, db } = await fb();
  try {
    await fs.setDoc(fs.doc(db, "participants", email), {
      name, email, phone, consent: true, createdAt: fs.serverTimestamp()
    });
  } catch (e) {
    if (e && e.code === "permission-denied") throw new Error("denied");
    throw e;
  }
}

export function watchAuth(cb) {
  if (DEMO) { setTimeout(() => cb({ email: ADMIN_EMAIL, demo: true }), 0); return () => {}; }
  let unsub = () => {};
  fb().then(({ au, auth }) => { unsub = au.onAuthStateChanged(auth, cb); });
  return () => unsub();
}

export async function signIn() {
  if (DEMO) return;
  const { au, auth } = await fb();
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await au.signInWithPopup(auth, provider);
}

export async function signOut() {
  if (DEMO) return;
  const { au, auth } = await fb();
  await au.signOut(auth);
}

export async function setOpen(open) {
  if (DEMO) { demo.open = open; emit("config"); return; }
  const { fs, db } = await fb();
  await fs.setDoc(fs.doc(db, "config", "sorteo"), { open, updatedAt: fs.serverTimestamp() }, { merge: true });
}

export function watchParticipants(cb, onErr) {
  if (DEMO) return demoSub("participants", cb);
  let unsub = () => {};
  fb().then(({ fs, db }) => {
    unsub = fs.onSnapshot(fs.collection(db, "participants"), (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, name: x.name, email: x.email, phone: x.phone, createdAt: toMs(x.createdAt) };
      }).sort((a, b) => a.createdAt - b.createdAt);
      cb(list);
    }, (e) => onErr && onErr(e));
  });
  return () => unsub();
}

export function watchWinners(cb, onErr) {
  if (DEMO) return demoSub("winners", cb);
  let unsub = () => {};
  fb().then(({ fs, db }) => {
    unsub = fs.onSnapshot(fs.collection(db, "winners"), (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, name: x.name, email: x.email, phone: x.phone, order: x.order, discarded: x.discarded === true, wonAt: toMs(x.wonAt) };
      }).sort((a, b) => a.order - b.order);
      cb(list);
    }, (e) => onErr && onErr(e));
  });
  return () => unsub();
}

export async function addWinner(p, order) {
  const w = { name: p.name, email: p.email, phone: p.phone, order, discarded: false };
  if (DEMO) { demo.winners.push({ id: p.id, ...w, wonAt: Date.now() }); emit("winners"); return; }
  const { fs, db } = await fb();
  await fs.setDoc(fs.doc(db, "winners", p.id), { ...w, wonAt: fs.serverTimestamp() });
}

export async function setDiscarded(id, discarded) {
  if (DEMO) { const w = demo.winners.find((x) => x.id === id); if (w) w.discarded = discarded; emit("winners"); return; }
  const { fs, db } = await fb();
  await fs.updateDoc(fs.doc(db, "winners", id), { discarded });
}

export async function resetWinners(ids) {
  if (DEMO) { demo.winners = []; emit("winners"); return; }
  const { fs, db } = await fb();
  const batch = fs.writeBatch(db);
  ids.forEach((id) => batch.delete(fs.doc(db, "winners", id)));
  await batch.commit();
}
