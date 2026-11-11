# The Clothes Box: imagen de staging. Cero dependencias de npm, solo Node 20.
# No contiene secretos. Variables al ejecutar (ver docs/staging.md y .env.example):
#   JWT_SECRET, DATA_ENCRYPTION_KEY   obligatorias
#   PORT (3000), DATA_DIR (/data), APP_BASE_URL, CORS_ORIGINS, POLICY_VERSION,
#   ADMIN_EMAIL, ADMIN_PASSWORD, STYLIST_EMAIL, STYLIST_PASSWORD, PAYMENT_WEBHOOK_SECRET,
#   PAYMENT_PROVIDER, INVOICING_PROVIDER, SHIPPING_PROVIDER, MAIL_PROVIDER (simulated)
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app
COPY package.json server.js ./
COPY backend ./backend
COPY frontend ./frontend
COPY docs/ejemplo_catalogo.csv ./docs/ejemplo_catalogo.csv

# Los datos de ejecución viven en un volumen, fuera de la imagen.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node
EXPOSE 3000
CMD ["node", "server.js"]
