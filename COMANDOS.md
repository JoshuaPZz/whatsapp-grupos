# Comandos del proyecto

## 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd whatsapp-grupos
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Ejecutar el proyecto

```bash
node index.js
```

## 4. Si quieres volver a instalar desde cero

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

## Notas

- La primera vez que corras el proyecto, WhatsApp puede pedir escanear un codigo QR.
- Las sesiones locales se guardan en `.wwebjs_auth/` y la cache en `.wwebjs_cache/`.
- Esas carpetas ya quedaron ignoradas en Git.
