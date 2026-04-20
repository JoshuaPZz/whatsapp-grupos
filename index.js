const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

const CODIGO_PAIS = "57";
const DELAY_MIN = 2500;
const DELAY_MAX = 6000;
const RETRY_DELAY_MIN = 8000;
const RETRY_DELAY_MAX = 15000;
const MAX_REINTENTOS = 2;
const NOMBRE_GRUPO_GENERAL = "GRUPO GENERAL";
const ARCHIVO_PROGRESO = path.join(__dirname, "progreso.json");
const NUMEROS_COMUNES = ["3118468556","3138850555"];

const GRUPOS = [
  { nombre: "EXPEDICION TABIO", numeros: ["3178679591"] },
  { nombre: "COMPOSTECH GIRO", numeros: ["3156273545"] },
  { nombre: "Sembradores del Sumak Kawsay", numeros: ["3216707289"] },
  { nombre: "Raices digitales", numeros: ["3126492704"] },
  { nombre: "AquaBots", numeros: ["3108536257"] },
  { nombre: "EcoRa\u00edces STEAM Santa Rita", numeros: ["3104547121"] },
  { nombre: "Agroanfibia", numeros: ["3128926280"] },
  { nombre: "GIDISCOP", numeros: ["3005413977"] },
  { nombre: "Bioexploradores", numeros: ["3116104655"] },
  { nombre: "Fxiw wewet wewet fxi\u00b4zenxi (semillero para la armonia y el buen vivir)", numeros: ["3224688475", "3127177254"] },
  { nombre: "suelobot", numeros: ["3027454573"] },
  { nombre: "I.D.E.A.S 3D", numeros: ["3184470633"] },
  { nombre: "Retamo-cero tech", numeros: ["3203152834"] },
  { nombre: "NEOTECH CIUDAD LATINA COLSUBSIDIO", numeros: ["3212140776"] },
  { nombre: "Neotech Nuevo Compartir Colsubsidio", numeros: ["3212140776"] },
  { nombre: "Tejiendo ciencia", numeros: ["3172959923"] },
  { nombre: "Semillas de Innovaci\u00f3n", numeros: ["3127781559"] }
];

const sleep = (min = DELAY_MIN, max = DELAY_MAX) => {
  const rango = Math.max(max - min, 0);
  const delay = min + Math.floor(Math.random() * (rango + 1));
  return new Promise(resolve => setTimeout(resolve, delay));
};

const log = mensaje => {
  console.log(`[${new Date().toLocaleTimeString("es-CO")}] ${mensaje}`);
};

function normalizarNombre(nombre) {
  return String(nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatNumber(numero) {
  const limpio = String(numero || "").replace(/\D/g, "");
  if (!limpio) return null;
  if (limpio.length === 10) return `${CODIGO_PAIS}${limpio}@c.us`;
  if (limpio.length === 12) return `${limpio}@c.us`;
  if (limpio.length === 13 && limpio.startsWith("+")) return `${limpio.slice(1)}@c.us`;
  return null;
}

function crearEstadoVacio() {
  return {
    creados: [],
    numeros: []
  };
}

function cargarProgreso() {
  if (!fs.existsSync(ARCHIVO_PROGRESO)) {
    return crearEstadoVacio();
  }

  try {
    const contenido = fs.readFileSync(ARCHIVO_PROGRESO, "utf8").trim();
    if (!contenido) {
      return crearEstadoVacio();
    }

    const data = JSON.parse(contenido);
    return {
      creados: Array.isArray(data.creados) ? data.creados.filter(Boolean) : [],
      numeros: Array.isArray(data.numeros) ? data.numeros.filter(Boolean) : []
    };
  } catch (error) {
    log(`⚠️ No se pudo leer ${path.basename(ARCHIVO_PROGRESO)}: ${error.message}`);
    return crearEstadoVacio();
  }
}

function guardarProgreso(creados, numerosValidos) {
  const data = {
    creados: [...creados].sort((a, b) => a.localeCompare(b, "es")),
    numeros: [...numerosValidos].sort((a, b) => a.localeCompare(b, "es"))
  };

  fs.writeFileSync(ARCHIVO_PROGRESO, JSON.stringify(data, null, 2), "utf8");
}

function construirGruposLimpios(grupos) {
  const resultado = [];

  for (const grupo of grupos) {
    const nombre = String(grupo.nombre || "").trim();
    const numerosGrupo = Array.isArray(grupo.numeros)
      ? grupo.numeros
      : grupo.numero
        ? [grupo.numero]
        : [];
    const numeros = [...new Set([...numerosGrupo, ...NUMEROS_COMUNES])];
    const ids = numeros.map(formatNumber).filter(Boolean);
    const nombreNormalizado = normalizarNombre(nombre);

    if (!nombre || ids.length === 0) {
      log(`⚠️ Registro omitido por datos inválidos: ${JSON.stringify(grupo)}`);
      continue;
    }

    resultado.push({
      nombre,
      numeros,
      ids,
      nombreNormalizado
    });
  }

  return resultado;
}

const GRUPOS_LIMPIOS = construirGruposLimpios(GRUPOS);

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "modo-dios" }),
  puppeteer: {
    headless: true,
    protocolTimeout: 180000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  }
});

let ejecucionEnCurso = false;

client.on("qr", qr => {
  log("📲 Escanea el QR");
  qrcode.generate(qr, { small: true });
});

client.on("loading_screen", (percent, message) => {
  log(`⏳ Cargando WhatsApp: ${percent}% ${message || ""}`.trim());
});

client.on("authenticated", () => {
  log("🔐 Sesión autenticada");
});

client.on("auth_failure", message => {
  log(`❌ Falló la autenticación: ${message}`);
});

client.on("change_state", state => {
  log(`🔄 Estado del cliente: ${state}`);
});

client.on("disconnected", reason => {
  log(`⚠️ Cliente desconectado: ${reason}`);
});

async function ejecutarProceso() {
  const progreso = cargarProgreso();
  const creados = new Set(progreso.creados);
  const numerosValidos = new Set(progreso.numeros);

  let chats = await client.getChats();
  let nombresChats = new Set(chats.map(chat => normalizarNombre(chat.name)));

  for (let i = 0; i < GRUPOS_LIMPIOS.length; i += 1) {
    const grupo = GRUPOS_LIMPIOS[i];

    if (creados.has(grupo.nombre)) {
      log(`⏭️ Ya estaba marcado en progreso: ${grupo.nombre}`);
      continue;
    }

    log(`📦 [${i + 1}/${GRUPOS_LIMPIOS.length}] ${grupo.nombre}`);

    if (nombresChats.has(grupo.nombreNormalizado)) {
      log(`⏭️ Ya existe en WhatsApp: ${grupo.nombre}`);
      creados.add(grupo.nombre);
      guardarProgreso(creados, numerosValidos);
      continue;
    }

    let creado = false;

    for (let intento = 1; intento <= MAX_REINTENTOS; intento += 1) {
      try {
        const participantesValidos = [];

        for (let j = 0; j < grupo.ids.length; j += 1) {
          const id = grupo.ids[j];
          const numero = grupo.numeros[j];
          const registrado = await client.isRegisteredUser(id);

          if (!registrado) {
            log(`⏭️ El número no tiene WhatsApp: ${numero}`);
            continue;
          }

          participantesValidos.push(id);
          numerosValidos.add(id);
        }

        if (participantesValidos.length === 0) {
          log(`⏭️ ${grupo.nombre} no tiene participantes válidos`);
          creado = true;
          break;
        }

        const respuesta = await client.createGroup(grupo.nombre, participantesValidos);
        const groupId =
          respuesta?.gid?._serialized ||
          respuesta?.id?._serialized ||
          respuesta?.groupMetadata?.id?._serialized ||
          null;

        log(`✅ Grupo creado: ${grupo.nombre}`);

        creados.add(grupo.nombre);
        guardarProgreso(creados, numerosValidos);

        chats = await client.getChats();
        nombresChats = new Set(chats.map(chat => normalizarNombre(chat.name)));

        await sleep(5000, 8000);

        if (groupId) {
          try {
            const chat = await client.getChatById(groupId);
            if (chat) {
              await chat.setDescription(`Grupo ${grupo.nombre}`);
            }
          } catch (error) {
            log(`⚠️ No se pudo actualizar la descripción de ${grupo.nombre}: ${error.message}`);
          }
        }

        creado = true;
        break;
      } catch (error) {
        const mensaje = error?.message || String(error);
        log(`⚠️ Error en intento ${intento} para ${grupo.nombre}: ${mensaje}`);

        if (mensaje.includes("Lid is missing")) {
          log(`🧠 WhatsApp respondió tarde y probablemente el grupo sí se creó: ${grupo.nombre}`);
          creados.add(grupo.nombre);
          guardarProgreso(creados, numerosValidos);
          creado = true;
          break;
        }

        if (intento < MAX_REINTENTOS) {
          await sleep(RETRY_DELAY_MIN, RETRY_DELAY_MAX);
        }
      }
    }

    if (!creado) {
      log(`❌ Falló definitivamente: ${grupo.nombre}`);
    }

    await sleep();
  }

  const grupoGeneralExiste = nombresChats.has(normalizarNombre(NOMBRE_GRUPO_GENERAL));

  if (grupoGeneralExiste) {
    log(`⏭️ ${NOMBRE_GRUPO_GENERAL} ya existe`);
    return;
  }

  const lista = [...new Set(numerosValidos)];

  if (lista.length === 0) {
    log("⚠️ No hay números válidos para crear el grupo general");
    return;
  }

  if (lista.length > 256) {
    log(`⚠️ Se usarán solo los primeros 256 contactos para ${NOMBRE_GRUPO_GENERAL}`);
  }

  log(`🌍 Creando ${NOMBRE_GRUPO_GENERAL}`);

  try {
    await client.createGroup(NOMBRE_GRUPO_GENERAL, lista.slice(0, 256));
    log(`✅ ${NOMBRE_GRUPO_GENERAL} creado`);
  } catch (error) {
    log(`❌ Error al crear ${NOMBRE_GRUPO_GENERAL}: ${error.message}`);
  }
}

client.on("ready", async () => {
  if (ejecucionEnCurso) {
    log("⏭️ Ya hay una ejecución en curso, se ignora este evento ready");
    return;
  }

  ejecucionEnCurso = true;
  log("🚀 Cliente listo");

  try {
    await sleep(6000, 9000);
    await ejecutarProceso();
    log("🎉 TODO TERMINADO");
  } catch (error) {
    log(`💥 Error fatal durante la ejecución: ${error.stack || error.message}`);
  } finally {
    ejecucionEnCurso = false;
  }
});

process.on("unhandledRejection", error => {
  log(`💥 Promesa no manejada: ${error?.stack || error}`);
});

process.on("uncaughtException", error => {
  log(`💥 Excepción no capturada: ${error?.stack || error}`);
});

client.initialize().catch(error => {
  const mensaje = error?.message || String(error);
  log(`💥 No se pudo iniciar WhatsApp Web: ${mensaje}`);

  if (mensaje.includes("spawn EPERM")) {
    log("💡 El navegador embebido no pudo abrirse. Revisa permisos del sistema o ejecuta fuera del entorno restringido.");
  }
});
