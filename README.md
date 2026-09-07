# iptv-verified-list

Lista de canales IPTV verificados, actualizada automáticamente cada 3 días por GitHub Actions.

## Lista verificada

**URL para la app:**
```
https://raw.githubusercontent.com/neilroman/iptv-verified-list/main/data/verified_streams.json
```

## Estadísticas (última validación)

Se validan ~17,000 streams de [iptv-org/database](https://github.com/iptv-org/database) con HEAD requests paralelas.
Solo los que responden (HTTP 200-399) entran a la lista.

| Campo | Valor |
|-------|-------|
| Fuente | iptv-org/database |
| Frecuencia | Cada 3 días |
| Método | HEAD request (timeout 7s) |
| Concurrencia | 50 conexiones paralelas |

## Cómo funciona

1. GitHub Actions descarga `streams.json` y `channels.json` de iptv-org
2. Divide en 5 batches y los prueba en paralelo
3. Genera `data/verified_streams.json` con solo los streams que responden
4. Hace commit automático si hay cambios

## Actualización manual

Ve a **Actions → Validate IPTV Streams → Run workflow**.
