// ============================================================
//  CONFIGURACIÓN — solo tienes que editar este archivo
// ============================================================

// 1) Pega aquí la configuración de tu proyecto Firebase
//    (Consola Firebase > ⚙️ Configuración del proyecto > Tus apps > App web)
//    Mientras diga "PEGA_...", el sitio funciona en MODO DEMO con participantes de prueba.
export const firebaseConfig = {
  apiKey: "AIzaSyBY-jPYnNHg5nql3G3b5eAcqc1c6VU1ZBs",
  authDomain: "nq-sorteo.firebaseapp.com",
  projectId: "nq-sorteo",
  storageBucket: "nq-sorteo.firebasestorage.app",
  messagingSenderId: "305151079054",
  appId: "1:305151079054:web:0bc878ef00e0afc2488fdf"
};

// 2) Tu correo de Google: el ÚNICO que puede abrir la ruleta.
//    Debe ser exactamente el mismo que pongas en firestore.rules
export const ADMIN_EMAIL = "homieoficial1@gmail.com";

// 3) Premios
export const TOTAL_PREMIOS = 5;
export const PREMIO = "Cuenta de fondeo";

// No tocar
export const DEMO = firebaseConfig.apiKey.startsWith("PEGA_");
