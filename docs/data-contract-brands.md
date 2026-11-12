# Contrato de datos para marcas aliadas (CSV de catálogo)

Este documento especifica el formato, estructura, tipos de datos y reglas de validación que deben cumplir los archivos CSV suministrados por las marcas aliadas para la importación y actualización de prendas en **The Clothes Box**.

---

## 1. Especificación técnica del archivo

- **Formato:** Archivo de texto plano delimitado por comas (CSV estándar RFC 4180).
- **Codificación:** UTF-8 sin BOM.
- **Separador de campos:** Coma (`,`).
- **Separador de listas internas:** Pleca (`|`) en campos multilínea/multivalor (estilo, ocasión).
- **Escape de texto:** Si un valor contiene comas, comillas dobles o saltos de línea, debe ir encerrado entre comillas dobles (`"..."`), y las comillas internas duplicadas (`""`).
- **Límite de tamaño por archivo:** 2 MB por solicitud (`CSV_IMPORT_MAX_BYTES`).
- **Encabezado:** La primera fila es obligatoria y debe coincidir exactamente con los nombres de columna en minúsculas.

---

## 2. Columnas obligatorias y especificación

| Columna | Tipo | Requerido | Descripción | Ejemplo / Valores permitidos |
|---|---|:---:|---|---|
| `marca` | Texto (max 80) | Sí | Nombre comercial de la marca aliada registrada. | `Ceiba Estudio`, `Mono Textil` |
| `nombre` | Texto (max 120) | Sí | Nombre de la prenda (sin incluir la talla). | `Camisa Guayabera Lino Crudo` |
| `categoria` | Enum | Sí | Categoría de la prenda. Debe pertenecer al vocabulario de producto. | `top`, `bottom`, `capa`, `calzado`, `accesorio` |
| `estilo` | Lista Enum (`\|`) | Sí | Uno o más estilos separados por pleca. Vocabulario controlado. | `artesanal\|clasico`, `urbano`, `deportivo` |
| `ocasion` | Lista Enum (`\|`) | Sí | Una o más ocasiones de uso separadas por pleca. Vocabulario controlado. | `clase\|fiesta`, `entrevista`, `oficina` |
| `talla` | Enum | Sí | Talla de la variante. Vocabulario controlado. | `XS`, `S`, `M`, `L`, `XL` (calzado: `37`..`43`) |
| `color` | Texto (max 60) | Sí | Nombre legible del color de la variante. | `Crudo`, `Negro`, `Café tabaco` |
| `precio_mayorista` | Entero positivo | Sí | Costo unitario mayorista en COP (lo que TCB paga a la marca). | `42000`, `38000` |
| `stock` | Entero $\ge 0$ | Sí | Unidades físicas disponibles para entrega inmediata. | `6`, `10`, `0` |
| `precio_venta` | Entero positivo | Sí | Precio de venta sugerido al público (PVP) en COP. | `139000`, `119000` |
| `ciudad` | Texto (max 80) | No | Ciudad de origen o confección en Colombia. | `Cali`, `Medellín`, `Bogotá` |
| `corte` | Enum | No | Silueta o corte de confección. | `regular`, `ajustado`, `holgado`, `oversize` |
| `tejido` | Texto (max 120) | No | Composición textil principal. | `100% lino`, `Ripstop poliamida` |
| `linea` | Enum | No | Línea de target. | `u` (unisex), `f` (femenino), `m` (masculino) |
| `imagen_url` | URL | No | Enlace HTTPS público directo a la fotografía de la prenda. | `https://.../img1.jpg` |

---

## 3. Vocabularios controlados

Para garantizar que el motor de recomendación híbrido y el filtro del estilista puedan emparejar prendas correctamente con los cuestionarios de los suscriptores, los siguientes valores son estrictos:

### Categorías (`categoria`)
- `top` (camisas, camisetas, blusas)
- `bottom` (pantalones, jeans, bermudas, joggers)
- `capa` (chaquetas, sobrecamisas, hoodies, buzos)
- `calzado` (zapatos, zapatillas)
- `accesorio` (gorros, pañoletas, cinturones)

### Estilos (`estilo`)
`casual`, `urbano`, `clasico`, `vintage`, `minimalista`, `deportivo`, `bohemio`, `elegante`, `arriesgado`, `formal`, `retro`, `artesanal`.

### Ocasiones (`ocasion`)
`diario`, `trabajo`, `fin_de_semana`, `evento`, `noche`, `universidad`, `clase`, `fiesta`, `entrevista`, `oficina`.

### Tallas (`talla`)
- Prendas generales: `XS`, `S`, `M`, `L`, `XL`.
- Calzado: `37`, `38`, `39`, `40`, `41`, `42`, `43`.

---

## 4. Identificadores SKU y variantes

1. Cada combinación de `(nombre, talla, color)` representa una **Variante** única.
2. El sistema autogenera o asocia un **SKU** único con formato:
   `[SLUG_PRENDA]-[TALLA]-[COLOR]` (por ejemplo: `CHAQ-PANA-M-CAFE`).
3. Al reimportar un archivo CSV:
   - Si el SKU o variante ya existe, el sistema actualiza su stock (`stock`) y precios (`precio_mayorista`, `precio_venta`).
   - Las unidades reservadas para cajas de suscriptores en proceso de entrega **no pueden ser superadas** por una reducción de stock en el CSV; si el nuevo stock es menor a las unidades reservadas, la fila se reporta con error.
   - Las filas válidas se procesan e importan inmediatamente aunque otras filas del mismo lote presenten errores.

---

## 5. Reporte de errores de importación

La API de importación (`POST /api/admin/catalog/import`) valida fila por fila y devuelve un JSON estructurado con:
```json
{
  "imported": 5,
  "updated": 2,
  "errors": [
    { "row": 4, "field": "precio_mayorista", "message": "El precio debe ser un número entero positivo en COP." },
    { "row": 7, "field": "estilo", "message": "El estilo 'psicodelico' no pertenece al vocabulario permitido." }
  ]
}
```

Las filas con error no detienen la importación de las filas correctas. El administrador puede revisar el desglose de errores directamente en el panel administrativo.
