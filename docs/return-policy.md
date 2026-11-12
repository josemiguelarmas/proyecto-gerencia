# Política de Cambios y Devoluciones por Talla

> **AVISO IMPORTANTE: BORRADOR PENDIENTE DE REVISIÓN LEGAL**  
> Este documento constituye una base de trabajo técnico-operativa para el servicio de The Clothes Box en Colombia y está pendiente de validación formal por el equipo legal y el asesor comercial.

---

## 1. Alcance y Filosofía del Servicio

The Clothes Box opera bajo un modelo de suscripción mensual de moda con selección personalizada y curaduría por estilista ("efecto sorpresa").

Debido a la naturaleza del servicio curado:
- **No se aceptan devoluciones por razones de gusto subjetivo u opinión.** El feedback sobre prendas que no sean del agrado del usuario se procesa a través del sistema de calificación de estilo para reentrenar los algoritmos de personalización en entregas futuras.
- **Los cambios gratuitos aplican exclusivamente por problemas objetivos de talla o ajuste físico** (la prenda queda muy pequeña, muy grande o con discordancia de proporciones anatómicas).

---

## 2. Plazo de Solicitud (Ventana de 5 Días Hábiles)

1. El suscriptor dispone de una ventana máxima de **cinco (5) días hábiles** contados a partir de la fecha y hora oficial de entrega de la caja reportada por el operador logístico.
2. Para el cómputo de días hábiles:
   - Se excluyen sábados, domingos y los días festivos oficiales de la República de Colombia (según Ley 51 de 1983 - Ley Emiliani).
   - El vencimiento opera a las 23:59:59 del quinto día hábil.
3. Solicitudes radicadas fuera de esta ventana serán rechazadas automáticamente por el sistema con código de estado HTTP 422 (`RETURN_WINDOW_EXPIRED`).

---

## 3. Condiciones de las Prendas

Para que proceda la recolección y cambio de la prenda:
1. La prenda debe encontrarse **sin uso, sin lavar y en perfecto estado de conservación**.
2. Debe conservar todas las etiquetas originales de marca y de The Clothes Box adheridas e intactas.
3. Solo se permite **una (1) solicitud de cambio por prenda** recibida en la caja.

---

## 4. Alternativas de Resolución ante Falta de Stock

Cuando el suscriptor solicite un cambio de talla y el inventario de la variante solicitada se encuentre agotado (`NO_STOCK_IN_SIZE`), el sistema ofrecerá dos opciones de resolución:
1. **Prenda Equivalente (`EQUIVALENT`):** Seleccionar una prenda alternativa de la misma categoría, afinidad de estilo y valor comercial equivalente disponible en su talla.
2. **Solo Devolución (`RETURN_ONLY`):** Devolver la prenda sin reposición inmediata, registrando un crédito a favor en el saldo de la suscripción.

---

## 5. Proceso Logístico Inverso

1. Toda solicitud aprobada genera automáticamente una **Guía de Logística Inversa** identificada con el prefijo `TCB-DEV-AAAAMMDD-XXXX`.
2. El suscriptor puede descargar e imprimir el comprobante de logística inversa desde la plataforma.
3. La recogida en el domicilio del suscriptor y el reenvío de la prenda de cambio **no tienen costo adicional** dentro del perímetro urbano de cobertura en Cali.
4. Una vez la prenda arriba a la bodega y el operador confirma su estado, la variante reingresa al inventario disponible (`RETURN_IN`).
