---
title: "Venti CLI"
excerpt: "Accede a tus recursos de Venti desde la línea de comandos."
category: ""
---

El **Venti CLI** es un envoltorio liviano sobre la [API de Venti](https://docs.ventipay.com/) que te permite operar desde la terminal. Al igual que el [SDK de Node.js](https://github.com/ventipay/ventipay-node), hay un comando por recurso y una subacción por acción de la API: si conoces la API, ya sabes usar el CLI.

Está pensado para personas **y agentes de IA**: salida JSON por defecto, códigos de salida estables y un manifiesto de comandos consultable con `venti schema`.

> 📘 Convención de comandos
>
> ```
> venti <recurso> <acción> [id] [--parámetros]
> ```
>
> Las acciones que obtienen o modifican un recurso (`retrieve`, `update`, `refund`, etc.) reciben el `<id>` como primer argumento posicional. Las acciones de listado (`list`) no reciben `id`.

# Instalación

```bash
npm install -g @ventipay/cli
# o
yarn global add @ventipay/cli
```

Requiere Node.js 16+. Esto deja disponible el comando `venti`.

# Autenticación

El CLI usa tu API Key, igual que la API y el SDK. Puedes obtenerla en el [Dashboard](https://dashboard.ventipay.com/), en modo [live o test](https://docs.ventipay.com/reference/modes). La key se resuelve en este orden de prioridad:

1. Flag `--api-key <key>`
2. Variable de entorno `VENTIPAY_API_KEY` (o `VENTI_API_KEY`)
3. Archivo de configuración local

```bash
# Opción A: variable de entorno
export VENTIPAY_API_KEY="key_test_..."

# Opción B: guardarla en el archivo de configuración
venti config set api_key key_test_...
```

> 📘 El modo (live/test) está determinado por el prefijo de la key
>
> No necesitas configurarlo aparte: una key `key_test_...` opera en modo test y una `key_live_...` en modo live.

El archivo de configuración se guarda en `~/.ventipay/config.json` con permisos `0600` (solo lectura/escritura para tu usuario).

# Uso básico

```bash
# Crear un checkout
venti checkouts create --amount 1000 --currency CLP --metadata.order_id A-12

# Obtener un checkout, expandiendo el cliente
venti checkouts retrieve chk_KaIq81HaHvaPq91c8FaK1ua6R --expand customer

# Listar pagos con filtros
venti payments list --limit 10 --status paid

# Reembolsar un pago
venti payments refund pay_123 --amount 500

# Cancelar una suscripción
venti subscriptions end sub_123
```

Usa `venti --help` para ver todos los recursos, `venti <recurso> --help` para ver las acciones de un recurso y `venti <recurso> <acción> --help` para ver la firma de una acción.

# Parámetros

Los `--parámetros` corresponden a los *query params* (en lecturas) o *body params* (en escrituras) documentados en la API. Se construyen así:

| Forma | Resultado |
| ----- | --------- |
| `--key value` o `--key=value` | `{ "key": "value" }` |
| `--flag` | `{ "flag": true }` |
| `--key a --key b` | `{ "key": ["a", "b"] }` (repetición) |
| `--metadata.order_id A-12` | `{ "metadata": { "order_id": "A-12" } }` (anidado) |
| `--items[0].sku abc --items[0].qty 2` | `{ "items": [{ "sku": "abc", "qty": 2 }] }` |
| `--tags[] a --tags[] b` | `{ "tags": ["a", "b"] }` (append) |

Los valores se convierten automáticamente: `true`/`false` → booleano, `null` → null y los números → number. Usa `--raw-strings` para desactivar la conversión, o entrega el cuerpo completo como JSON:

```bash
# Cuerpo completo como JSON
venti checkouts create --data '{"amount":1000,"currency":"CLP"}'

# Desde un archivo
venti checkouts create --data @checkout.json
venti checkouts create --file checkout.json

# Desde stdin (de forma explícita con @-)
echo '{"amount":1000,"currency":"CLP"}' | venti checkouts create --data @-
```

Los `--parámetros` individuales se aplican sobre el objeto base de `--data`/`--file`, así que puedes combinarlos.

> 🚧 El CLI nunca lee stdin de forma automática
>
> La lectura de stdin es explícita (`--data @-` o `--file -`) para que el CLI no se quede bloqueado esperando entrada en contextos no interactivos (CI, agentes, scripts).

# Formatos de salida

Por defecto el CLI imprime **JSON formateado** a `stdout`. Los errores se imprimen como JSON a `stderr`.

| Flag | Efecto |
| ---- | ------ |
| `-o, --output <pretty\|compact\|table\|raw>` | Formato de salida (`pretty` por defecto) |
| `--compact` | Alias de `--output compact` (JSON en una línea) |
| `--table` | Alias de `--output table` (tabla legible) |
| `--no-color` | Desactiva colores en la tabla (también respeta `NO_COLOR`) |
| `-q, --quiet` | Imprime solo el campo `id` del resultado |

```bash
# Útil en scripts
ID=$(venti checkouts create --amount 1000 --currency CLP --quiet)
venti payments list --compact | jq '.data[].id'
```

## Salida en tabla

`--table` (o `-o table`) renderiza una tabla alineada y legible, ideal para revisar resultados en la terminal. Una lista se muestra como una fila por elemento; un recurso individual como una tabla de campo/valor. Los colores se agregan automáticamente en una terminal interactiva (booleanos, números, null) y **siempre se desactivan cuando la salida se redirige** (pipe), así que JSON sigue siendo la opción correcta para scripts y agentes.

```bash
venti payments list --limit 10 --table
```

```text
id        object   status    amount  currency     created  metadata
────────  ───────  ────────  ──────  ────────  ──────────  ───────────────────
pay_1AbC  payment  paid       19990  CLP       1717200000  {"order_id":"A-12"}
pay_2XyZ  payment  pending     5000  CLP       1717210000  {}
3 rows  ·  +1 more column (use --output json)  ·  has_more: true
```

Cuando hay muchas columnas, las que no caben en el ancho de la terminal se omiten (se indica cuántas) y los valores anidados se compactan. Para los datos completos, usa la salida JSON por defecto.

# Paginación

Los endpoints de listado usan paginación por cursor: cada respuesta retorna hasta `limit` registros (1–200, por defecto 10) junto con un `next_cursor` y un `previous_cursor`.

La forma simple — **`--all`** sigue los cursores por ti y retorna una sola lista combinada, sin que tengas que pasar cursores entre llamadas:

```bash
venti payments list --all                  # todos los pagos, en una sola lista
venti payments list --all --status paid    # los filtros aplican en todas las páginas
venti payments list --all --max 500        # se detiene tras 500 registros
venti payments list --all --table          # combinable con cualquier formato
venti api get payments --all               # también funciona en el comando api directo
```

Con `--all`, el tamaño de página usa el máximo (200) salvo que definas `--limit`, y el `has_more`/`next_cursor` del resultado reflejan si quedan más registros (por ejemplo, cuando `--max` lo detiene antes).

> 🚧 Listas muy grandes
>
> `--all` realiza una solicitud por página hasta agotar el cursor. Para conjuntos muy grandes, acota con `--max` o filtros, o pagina manualmente.

La forma manual — pasa los cursores tú mismo (los parámetros mapean directo a la API):

```bash
# Primera página
venti payments list --limit 50
# Página siguiente: usa el next_cursor de la respuesta anterior
venti payments list --limit 50 --starting_after <next_cursor>
# Página anterior: usa el previous_cursor
venti payments list --limit 50 --ending_before <previous_cursor>
```

# Idempotencia

Para reintentar operaciones de escritura de forma segura, pasa una idempotency key:

```bash
venti checkouts create --amount 1000 --currency CLP --idempotency-key "pedido-A-12"
```

# Acceso directo a la API

Para cualquier endpoint, incluso los que aún no estén mapeados como recurso:

```bash
venti api get balance
venti api get payments --limit 5
venti api post checkouts --amount 1000 --currency CLP
```

En `GET` los parámetros van como query; en el resto, como body.

# Recibir webhooks localmente

`venti listen` te permite recibir los webhooks de tu cuenta en tu máquina mientras desarrollas, sin exponer una URL pública ni usar un túnel. Observa los eventos de tu cuenta (test o live, según tu API Key) y reenvía cada uno a una URL local:

```bash
venti listen --forward-to http://localhost:3000/webhook
```

Al iniciar imprime un **secreto de firma** para la sesión. Cada solicitud reenviada se firma con el mismo esquema que Venti usa en producción (header `venti-signature`, formato `t=<timestamp>,v1=<hmac>`), de modo que tu código de verificación de firma funciona localmente — solo configúralo con el secreto impreso.

```bash
# Reenviar solo ciertos tipos de evento
venti listen --forward-to http://localhost:3000/webhook --events payment.created,payment.refunded

# Solo observar eventos sin reenviarlos
venti listen

# Reenviar eventos creados desde una fecha
venti listen --forward-to http://localhost:3000/webhook --since 2026-01-01T00:00:00Z
```

| Flag | Efecto |
| ---- | ------ |
| `--forward-to <url>` | Hace `POST` de cada evento a esta URL local. Omítela para solo imprimir. |
| `--events <tipos>` | Tipos de evento a reenviar, separados por coma (por defecto: todos). |
| `--poll-interval <seg>` | Segundos entre consultas (por defecto `2`). |
| `--since <timestamp>` | Reenvía eventos creados desde un timestamp ISO. |
| `--print` | Imprime el JSON completo del evento (por defecto: una línea por evento). |
| `--skip-verify` | Omite la verificación TLS del destino local (HTTPS autofirmado). |

> 📘 Salida y latencia
>
> En una terminal verás una línea de resumen por evento; al redirigir la salida (pipe), los eventos se emiten como JSON por línea (uno por línea), fácil de procesar. La latencia es aproximadamente el intervalo de consulta (~1–2s). Presiona Ctrl+C para detener.

# Introspección (para agentes)

`venti schema` imprime el manifiesto completo de comandos en JSON: recursos, acciones, método HTTP, ruta, si requieren `id` y si envían body. Ideal para que un agente descubra las capacidades del CLI sin parsear texto de ayuda.

```bash
venti schema
venti schema --compact | jq '.resources[].name'
```

> 👍 Diseñado para agentes de IA
>
> Salida JSON por defecto, errores como JSON en `stderr`, códigos de salida estables, `--all` para paginar sin estado y `venti schema` para introspección. Combinando esto, un agente puede operar la API de Venti de forma confiable.

# Configuración

```bash
venti config set <clave> <valor>   # claves: api_key, host, port, base_path, schema
venti config get <clave>
venti config list                  # enmascara la api_key
venti config unset <clave>
venti config path                  # ruta del archivo de configuración
```

También puedes apuntar a otro host con `--host` / `--base-path`, o con las variables de entorno `VENTIPAY_HOST` / `VENTIPAY_BASE_PATH`.

# Códigos de salida

El CLI usa códigos de salida estables para facilitar su orquestación desde scripts y agentes.

| Código | Significado |
| ------ | ----------- |
| `0` | Éxito |
| `2` | Error desconocido / de red |
| `3` | Error de autenticación |
| `4` | Error de cobro (`charge_error`) |
| `5` | Recurso no encontrado |
| `6` | Solicitud inválida |
| `7` | Error de solicitud |
| `8` | Error de idempotencia |
| `9` | Límite de tasa excedido |
| `64` | Error de uso del CLI (argumentos inválidos) |

# Listado de recursos

Usa `venti <recurso> --help` para ver la firma de cada acción.

## Pagos
| Recurso | Acciones |
| ------ | ------ |
| [checkouts](https://docs.ventipay.com/reference/checkouts) | `retrieve`, `list`, `create`, `refund`, `cancel` |
| [payments](https://docs.ventipay.com/reference/payments) | `retrieve`, `list`, `create`, `update`, `authorize`, `capture`, `refund`, `cancel` |
| [refunds](https://docs.ventipay.com/reference/refunds) | `retrieve`, `list` |
| [payment_buttons](https://docs.ventipay.com/reference/payment_buttons) | `retrieve`, `list`, `create`, `update` |
| [coupons](https://docs.ventipay.com/reference/coupons) | `retrieve`, `list`, `create`, `update` |

## Suscripciones
| Recurso | Acciones |
| ------ | ------ |
| [subscriptions](https://docs.ventipay.com/reference/subscriptions) | `retrieve`, `list`, `create`, `update`, `start`, `end`, `suspend`, `unsuspend` |
| [invoices](https://docs.ventipay.com/reference/invoices) | `retrieve`, `list`, `create`, `update`, `finalize`, `markUncollectible`, `void`, `pay`, `send` |
| [plans](https://docs.ventipay.com/reference/plans) | `retrieve`, `list`, `create`, `update`, `subscribe` |
| [products](https://docs.ventipay.com/reference/products) | `retrieve`, `list`, `create`, `update` |
| [tax_rates](https://docs.ventipay.com/reference/tax_rates) | `retrieve`, `list`, `create`, `update` |

## Clientes
| Recurso | Acciones |
| ------ | ------ |
| [customers](https://docs.ventipay.com/reference/customers) | `retrieve`, `list`, `create`, `update`, `paymentMethods` |
| [mandates](https://docs.ventipay.com/reference/mandates) | `retrieve`, `list` |

## Métodos de pago
| Recurso | Acciones |
| ------ | ------ |
| [payment_methods](https://docs.ventipay.com/reference/payment_methods) | `retrieve`, `list`, `del` |
| [setup_intents](https://docs.ventipay.com/reference/setup_intents) | `retrieve`, `list`, `create`, `update`, `del`, `cancel` |

## Préstamos
| Recurso | Acciones |
| ------ | ------ |
| [loans](https://docs.ventipay.com/reference/loans) | `retrieve`, `list`, `create`, `authorize`, `refund` |
| [installments](https://docs.ventipay.com/reference/installments) | `retrieve`, `authorize` |

## Finanzas
| Recurso | Acciones |
| ------ | ------ |
| [balance](https://docs.ventipay.com/reference/balance) | `retrieve`, `overview` |
| [balance_transactions](https://docs.ventipay.com/reference/balance_transactions) | `retrieve`, `list` |
| [payouts](https://docs.ventipay.com/reference/payouts) | `retrieve`, `list` |
| [bank_accounts](https://docs.ventipay.com/reference/bank_accounts) | `retrieve`, `list`, `create`, `del` |

## Disputas
| Recurso | Acciones |
| ------ | ------ |
| [disputes](https://docs.ventipay.com/reference/disputes) | `retrieve`, `list`, `upload`, `confirm` |

## Eventos
| Recurso | Acciones |
| ------ | ------ |
| [events](https://docs.ventipay.com/reference/events) | `retrieve`, `list` |

## Webhooks
| Recurso | Acciones |
| ------ | ------ |
| [webhooks](https://docs.ventipay.com/reference/webhooks) | `retrieve`, `list`, `create`, `del` |
| [webhook_attempts](https://docs.ventipay.com/reference/webhook_attempts) | `list` |

## Otros
| Recurso | Acciones |
| ------ | ------ |
| [banks](https://docs.ventipay.com/reference/banks) | `list` |
| [currencies](https://docs.ventipay.com/reference/currencies) | `list` |

> 📘 `disputes upload`
>
> Esta acción espera `multipart/form-data` (subida de archivos), que el CLI aún no construye. Usa `venti api post disputes/<id>/upload` o el Dashboard para ese caso.
