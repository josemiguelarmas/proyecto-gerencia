# Staging

Guía para levantar un ambiente de staging de The Clothes Box. No hay un staging desplegado todavía: este documento dice qué hace falta y cómo probarlo localmente. No contiene credenciales.

## Requisitos

- Node 20 (sin dependencias de npm) o Docker.
- Un volumen o carpeta persistente para `DATA_DIR`.
- Secretos generados por el equipo y guardados en el gestor de secretos del proveedor de hosting, nunca en el repositorio.

## Variables de entorno

| Variable | Obligatoria | Valor en staging |
|---|---|---|
| `JWT_SECRET` | sí | Cadena aleatoria de 32 bytes o más, distinta de la de desarrollo. |
| `DATA_ENCRYPTION_KEY` | sí | Clave aleatoria de 32 bytes. Si se pierde, se pierden los datos cifrados. Respaldarla aparte. |
| `NODE_ENV` | no | `production` (la imagen ya lo define). Nunca `test`, porque desactiva la verificación de secretos. |
| `PORT` | no | `3000` o el que asigne el proveedor. |
| `DATA_DIR` | no | `/data` en la imagen, montado como volumen. |
| `APP_BASE_URL` | no | URL pública del staging, para los enlaces de los correos. |
| `CORS_ORIGINS` | no | URL pública del staging (se aplica desde Fase 1b). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Fase 1b | Cuenta de administración sembrada desde el ambiente. |
| `STYLIST_EMAIL`, `STYLIST_PASSWORD` | Fase 1b | Cuenta de estilista sembrada desde el ambiente. |
| `PAYMENT_WEBHOOK_SECRET` | sí, en cuanto haya pasarela real | Lo entrega la pasarela. |
| `POLICY_VERSION` | no | Versión vigente de la política de datos (`v1.0`). |
| `PAYMENT_PROVIDER`, `INVOICING_PROVIDER`, `SHIPPING_PROVIDER`, `MAIL_PROVIDER` | no | `simulated` hasta tener contratos reales (ver `docs/integrations.md`). |

Sin `JWT_SECRET` o `DATA_ENCRYPTION_KEY` el servidor termina con código 1 y un mensaje que dice cuál falta.

## Con Docker

```powershell
docker build -t theclothesbox:staging .
docker volume create tcb-data
docker run --rm -p 3000:3000 -v tcb-data:/data `
  -e JWT_SECRET="<secreto>" -e DATA_ENCRYPTION_KEY="<clave>" `
  -e APP_BASE_URL="http://localhost:3000" `
  theclothesbox:staging
```

Al primer arranque la base y el catálogo se crean en `/data` desde `backend/data/seed/`. Para volver al estado inicial, borra el volumen.

## Sin Docker (PowerShell)

```powershell
$env:JWT_SECRET = "<secreto>"
$env:DATA_ENCRYPTION_KEY = "<clave>"
$env:DATA_DIR = "C:/tcb-staging-data"
npm start
```

## Verificación después de desplegar

1. `GET /api/config` responde 200.
2. La pantalla de inicio carga en el navegador y se puede registrar una cuenta nueva.
3. En el panel de administración, la pestaña "Bandeja de Salida" muestra los correos marcados SIMULADO.
4. `npm test` pasó en CI (`.github/workflows/ci.yml`) para el commit desplegado.

## Pendiente

- Elegir proveedor de hosting y respaldo del volumen de datos (decisión del equipo).
- Hasta la Fase 1b el arranque todavía siembra las cuentas demo con contraseñas conocidas: no exponer este staging en público antes de esa fase.
- La imagen no se ha construido en esta sesión (Docker no estaba disponible en la máquina de desarrollo).
