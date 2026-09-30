# NQ PROJECT · Sorteo en vivo

Registro público + ruleta privada para regalar cuentas de fondeo en el stream de YouTube.

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | El chat del stream | Formulario: nombre, correo y WhatsApp. Sin login. Un registro por correo. |
| `admin.html` | Solo tú | Entras con tu Google, abres/cierras registros, giras la ruleta, ves ganadores y descargas la lista. |

Los datos se guardan en Firebase (Firestore). Nadie más que tú puede leer la lista, ni aunque vea el código.

---

## 0. Pruébalo ya (modo demo)

Mientras `firebase-config.js` diga `PEGA_AQUI...`, todo funciona en **modo demo** con 48 participantes falsos.
Así puedes ver la ruleta apenas subas el repo a GitHub Pages (paso 1).

## 1. Subir a GitHub

1. En GitHub → **New repository** → nombre: `nq-sorteo` → **Public** → Create.
2. **Add file → Upload files** → arrastra TODOS los archivos de esta carpeta → Commit.
3. **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / `/ (root)` → Save.
4. En 1–2 minutos queda en:
   - Registro: `https://TU_USUARIO.github.io/nq-sorteo/`
   - Ruleta: `https://TU_USUARIO.github.io/nq-sorteo/admin.html`

## 2. Crear el proyecto de Firebase

> Usa un **proyecto nuevo** (puede ser en la misma cuenta de Google): si pegas estas reglas en un proyecto que ya usas para otra cosa, reemplazan las suyas y esa otra app deja de funcionar.

1. [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto** → `nq-sorteo` (Analytics no hace falta).
2. **Compilación → Firestore Database → Crear base de datos** → modo producción → ubicación cercana (ej. `us-east1`).
3. **Compilación → Authentication → Comenzar → Google → Habilitar** → Guardar.
4. **Authentication → Configuración → Dominios autorizados → Agregar dominio** → `TU_USUARIO.github.io`
5. **⚙️ Configuración del proyecto → Tus apps → `</>` (Web)** → registra la app → copia el objeto `firebaseConfig`.

## 3. Conectar

1. En GitHub abre `firebase-config.js` → ✏️ editar:
   - Pega tu `firebaseConfig`.
   - Cambia `ADMIN_EMAIL` por tu correo de Google.
   - Commit.
2. En Firebase → **Firestore → Reglas** → pega TODO el contenido de `firestore.rules`, verifica que el correo sea **el mismo** de `firebase-config.js` → **Publicar**.

## 4. Logo

Sube tu logo como `assets/logo.png` (fondo transparente, idealmente horizontal). Si no hay logo, se muestra el texto **NQ PROJECT**.

## 5. Ensayo (hazlo antes del stream)

1. Abre `admin.html`, entra con Google → **Abrir registros**.
2. Desde tu celular abre el link de registro y regístrate con 2–3 correos distintos.
3. Verás aparecer los nombres en la ruleta al instante.
4. **Cerrar registros** → **GIRAR RULETA**.
5. Al terminar: **Reiniciar ganadores**. Para borrar los participantes de prueba: Firebase → Firestore → colección `participants` → eliminar documentos (o borrar la colección completa).

## 6. Día del stream

1. `admin.html` → **Abrir registros**.
2. Comparte en el chat el link de registro (no el de admin).
3. Cuando quieras: **Cerrar registros** → **GIRAR RULETA** → repite hasta tener los 5.
4. **Modo stream** (activado por defecto) oculta correos y teléfonos en pantalla; solo se ve el correo parcial para que el ganador se reconozca. Desactívalo cuando ya no estés compartiendo pantalla para ver contactos y el botón de WhatsApp.
5. Si un ganador no responde: **Descartar** → el cupo queda libre y giras otra vez (el descartado no vuelve a entrar).
6. **Descargar lista (CSV)** para quedarte con todos los contactos (abre directo en Excel).

## Cómo funciona el sorteo

- El ganador se elige con `crypto.getRandomValues` (aleatorio criptográfico, sin sesgo) y la ruleta se anima hasta caer en esa persona.
- Quien ya ganó sale automáticamente de la ruleta en los siguientes giros.
- Un correo = un registro (Firestore rechaza duplicados). Solo se aceptan registros mientras estén abiertos, y eso lo valida el servidor, no la página.
- Plan gratuito de Firebase: sobra para miles de registros.
