# The Clothes Box — Prototipo Web Full-Stack Funcional (v2.1)

**Proyecto de Innovación y Emprendimiento II (2026)**  
**Universidad Icesi — Séptimo Semestre**  
**Equipo:** *Cangrejos* (Andrés Felipe López, Jaime Muñoz, Jose Miguel Armas, Sebastián Castillo)

---

## 1. Resumen Ejecutivo y Propósito

**The Clothes Box** es una plataforma de suscripción mensual de moda independiente colombiana que resuelve la incertidumbre de la talla *antes de pagar*, entregando selecciones sorpresa curadas a domicilio en Cali.

### El Problema Validado en Investigación:
* **Falsa disyuntiva:** Los jóvenes de 18 a 30 años en Colombia oscilan entre el *Fast Fashion* (genérico, masivo, mala calidad textil) y las *marcas de diseñador* (precios prohibitivos).
* **Barrera de la talla:** Aunque el comercio electrónico de moda crece aceleradamente en Colombia, el miedo a perder tiempo y dinero con devoluciones engorrosas detiene la compra.
* **Garantía real:** *"El problema no es la talla: es el costo de equivocarse"*. Con The Clothes Box, las medidas en centímetros se cruzan algorítmicamente antes del empaque, y cualquier prenda que no ajuste se cambia sin costo.

---

## 2. Novedades y Mejoras Clave (v2.1)

1. **Fotografía Real de Prendas de Marcas Colombianas:**
   * Se eliminaron por completo las siluetas vectoriales SVG, iconos genéricos o placeholders para prendas de ropa.
   * Cada una de las 18 piezas del catálogo oficial cuenta con fotografía real en alta resolución que refleja fielmente su corte, textura textil, color y silueta.
   * Marcas representadas: **Ceiba Estudio (Cali)**, **Taller Norte (Bogotá)**, **Mono Textil (Cali)**, **True (Medellín)**, **Punto Blanco** y **Mattelsa**.

2. **Corrección de la Experiencia "Mi Caja" (Descubrimiento Real):**
   * **En preparación o despacho (`PREPARING` / `SHIPPED`):** El usuario experimenta la expectativa con su caja sellada, guía de rastreo y cronograma de despacho. El backend no expone las prendas (`items: null`).
   * **Entregada (`DELIVERED`):** Tras el ritual de desempaque (*unboxing*), el usuario accede inmediatamente a la **visualización individual de cada prenda recibida**, con fotografía real, talla calibrada, porcentaje de ajuste, tabla de medidas en cm, tejido y precio de referencia.
   * **Outfits como complemento:** Las ideas de combinación se presentan como una sección adicional de estilismo, sin ocultar ni reemplazar la visualización de las prendas reales recibidas.

3. **Descubrimiento y Valoración Individual de Prendas:**
   * Cada prenda recibida cuenta con su propio modal de valoración:
     * Botones de afinidad: `[ 👍 Me gustó ]` o `[ 👎 No es mi estilo ]`.
     * Calificación de 1 a 5 estrellas.
     * Preferencias para futuras entregas (colores, formalidad, cortes).
     * Notas directas al estilista.
   * **Separación de conceptos:** Se notifica claramente que decir *"no me gustó"* o *"prefiero otro color"* afina el algoritmo para futuros ciclos pero **no genera devolución**. Los cambios están reservados estrictamente a problemas de talla o ajuste dimensional.

4. **Doble Rol con Control de Acceso Estricto (CLIENT y ADMIN):**
   * **Cliente (`CLIENT`):** Acceso a landing, onboarding antropométrico, estado de su caja actual, descubrimiento de prendas entregadas, valoración individual, historial personal y módulo de cambio de talla.
   * **Administrador (`ADMIN`):** Panel propio de gestión y operaciones (`#/admin`):
     * **Métricas Operativas:** Total clientes, cajas en taller y reparto, cajas entregadas, tasa de devoluciones por talla, satisfacción promedio (★ 4.8) y marcas activas.
     * **Auditoría de Cajas:** El administrador **sí puede consultar y auditar las prendas** asignadas a cualquier caja, incluso cuando están en preparación o en camino. Control manual para cambiar estados (`PREPARING` ➔ `SHIPPED` ➔ `DELIVERED`).
     * **Clientes & Perfiles:** Consulta de medidas corporales (estatura, peso, contextura, talla habitual) y direcciones de entrega en Cali.
     * **Catálogo Visual:** Galería de productos con fotografías oficiales, detalles técnicos y precios.
     * **Devoluciones por Talla:** Gestión de solicitudes con foto de la prenda, talla solicitada, dirección y cambio de estado (`Agendar Mensajero`, `En Taller`, `Completado`).
     * **Feedback de Estilo:** Monitoreo en tiempo real de valoraciones y comentarios de clientes.
   * **Validación en Backend:** Cualquier intento de un cliente de acceder a endpoints `/api/admin/*` es rechazado con **HTTP 403 Forbidden**.

---

## 3. Credenciales de Acceso para Demostración

| Rol | Correo Electrónico | Contraseña | Destino Inicial | Acceso Rápido |
| :--- | :--- | :--- | :--- | :--- |
| **Cliente** | `demo@theclothesbox.co` | `demo123` | `#/caja` | Botón *"Entrar Cliente"* en login |
| **Administrador** | `admin@theclothesbox.co` | `admin123` | `#/admin` | Botón *"Entrar Admin"* en login |

---

## 4. Estructura del Proyecto

Todo el desarrollo se encuentra confinado dentro de la carpeta `prototipo-web/`. La carpeta superior `Innovacion2` no ha sido modificada.

```text
prototipo-web/
├── backend/
│   ├── server.js          # Servidor HTTP nativo Node.js (API REST y estáticos)
│   ├── routes.js          # Rutas públicas, de cliente y administrativas protegidas
│   ├── auth.js            # Autenticación JWT y validación de roles (CLIENT/ADMIN)
│   ├── database.js        # Base de datos JSON atómica con métricas y persistencia
│   ├── engine.js          # Motor algorítmico de tallaje antropométrico
│   └── data/
│       ├── catalog.json   # 18 prendas de marcas colombianas con fotos reales y medidas en cm
│       └── db.json        # Almacenamiento de usuarios con roles, cajas y devoluciones
│
├── frontend/
│   ├── index.html         # Shell SPA accesible con fuentes Fraunces/Inter
│   ├── css/
│   │   ├── tokens.css     # Paleta de papel, tintas y espaciado
│   │   ├── base.css       # Resets y tipografía base
│   │   ├── components.css # Botones, tarjetas, modales y barra de navegación
│   │   ├── landing.css    # Storytelling inspirado en Apple.com
│   │   └── screens.css    # Vistas de caja, descubrimiento, admin y devoluciones
│   └── js/
│       ├── api.js         # Cliente HTTP con soporte para endpoints de cliente y admin
│       ├── brand.js       # Renderizado de fotografías reales y logo vectorial
│       ├── state.js       # Store reactivo, modales y notificaciones
│       ├── app.js         # Enrutador SPA con barra de navegación adaptada por rol
│       └── views/
│           ├── landingView.js     # Presentación y storytelling
│           ├── authView.js        # Modales de acceso dual (Cliente y Admin)
│           ├── onboardingView.js  # 3 pasos antropométricos hacia el backend
│           ├── boxView.js         # Caja sellada, desempaque y descubrimiento individual
│           ├── adminView.js       # Consola profesional de operaciones y auditoría
│           ├── returnsView.js     # Módulo especializado de cambio por talla
│           ├── historyView.js     # Historial de cajas y prendas entregadas
│           └── profileView.js     # Perfil antropométrico y marcas locales
│
├── tests/
│   └── api.test.js        # Suite de 15 pruebas automatizadas (Roles, Sorpresa, Admin, API)
├── package.json           # Scripts de arranque (`npm start`, `npm test`)
├── server.js              # Punto de entrada de la aplicación
└── README.md              # Documentación técnica completa
```

---

## 5. Instrucciones de Ejecución y Pruebas

### Iniciar la Aplicación Full-Stack
```bash
npm start
# o directamente:
node server.js
```
Abre en tu navegador:
```text
http://localhost:3000
```

### Ejecutar las 15 Pruebas Automatizadas del Backend
```bash
npm test
# o directamente:
node tests/api.test.js
```

Salida de la suite de pruebas:
```text
--- INICIANDO PRUEBAS DE BACKEND, ROLES Y REGLAS DE NEGOCIO ---
✓ 1. Catálogo con fotografías reales confirmado (18 productos con URL válida)
✓ 2. Rutas protegidas bloqueadas sin token (401 Unauthorized)
✓ 3. Autenticación de Cliente exitosa (Rol: CLIENT, JWT token generado)
✓ 4. Caja actual consultada: Caja #3 (Estado: DELIVERED)
✓ 5. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en estado PREPARING (items = null)
✓ 6. REGLA DE SORPRESA VERIFICADA EN CLIENTE: Prendas ocultas en estado SHIPPED (items = null)
✓ 7. REGLA DE ENTREGA VERIFICADA: Prendas reveladas con fotografías y ajuste de talla al cambiar a DELIVERED
✓ 8. VALORACIÓN INDIVIDUAL DE PRENDA VERIFICADA: Feedback registrado sin generar devolución
✓ 9. REGLA DE DEVOLUCIÓN VERIFICADA: Rechazo de motivos de gusto/opinión (status 400)
✓ 10. Devolución por talla aprobada y registrada en base de datos (201 Created)
✓ 11. CONTROL DE ACCESO VERIFICADO: Cliente bloqueado de rutas administrativas (403 Forbidden)
✓ 12. Autenticación de Administrador exitosa (Rol: ADMIN, JWT token generado)
✓ 13. Métricas administrativas operativas (Clientes, Cajas, Devoluciones)
✓ 14. PRIVILEGIO ADMINISTRATIVO VERIFICADO: El Administrador puede auditar prendas de cajas no entregadas
✓ 15. Vista administrativa de devoluciones con prendas, fotos y clientes confirmada
```

---

## 6. Matriz de Endpoints de la API REST

| Método | Endpoint | Rol Mínimo | Descripción |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Público | Registra cliente con rol `CLIENT` |
| `POST` | `/api/auth/login` | Público | Autentica y retorna token JWT y rol |
| `GET` | `/api/products` | Público | Catálogo con fotos reales y medidas en cm |
| `GET` | `/api/auth/me` | Autenticado | Datos del usuario y perfil en sesión |
| `GET` | `/api/profile` | `CLIENT` | Medidas antropométricas del cliente |
| `PUT` | `/api/profile` | `CLIENT` | Actualiza medidas corporales y dirección |
| `GET` | `/api/boxes/current` | `CLIENT` | Caja activa (**`items: null` si está en camino**) |
| `POST` | `/api/boxes/simulate-step` | `CLIENT` | Avanza simulación: `PREPARING` ➔ `SHIPPED` ➔ `DELIVERED` |
| `POST` | `/api/boxes/:id/unbox` | `CLIENT` | Desempaca caja entregada |
| `POST` | `/api/boxes/:id/item-feedback` | `CLIENT` | **Valoración y feedback de prenda individual** |
| `POST` | `/api/boxes/:id/ratings` | `CLIENT` | Calificaciones completas del ciclo |
| `GET` | `/api/boxes/history` | `CLIENT` | Cajas pasadas desempacadas con fotos |
| `POST` | `/api/boxes/next` | `CLIENT` | Solicita siguiente ciclo |
| `GET` | `/api/returns` | `CLIENT` | Historial de devoluciones y prendas elegibles |
| `POST` | `/api/returns` | `CLIENT` | Solicita cambio (**rechaza motivos ajenos a talla**) |
| `GET` | `/api/admin/metrics` | `ADMIN` | **KPIs y métricas de la plataforma** |
| `GET` | `/api/admin/clients` | `ADMIN` | **Lista de clientes y medidas antropométricas** |
| `GET` | `/api/admin/products` | `ADMIN` | **Catálogo completo de productos** |
| `POST` | `/api/admin/products` | `ADMIN` | **Crear o editar prenda en catálogo** |
| `GET` | `/api/admin/boxes` | `ADMIN` | **Auditoría de cajas (prendas visibles siempre)** |
| `POST` | `/api/admin/boxes/:id/status` | `ADMIN` | **Modificar estado de despacho de caja** |
| `GET` | `/api/admin/returns` | `ADMIN` | **Gestión de solicitudes de cambio de talla** |
| `PUT` | `/api/admin/returns/:id` | `ADMIN` | **Actualizar estado de recolección/taller** |
| `GET` | `/api/admin/feedback` | `ADMIN` | **Monitoreo de valoraciones de estilo** |
