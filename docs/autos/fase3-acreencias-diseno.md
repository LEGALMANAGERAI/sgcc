# Fase 3 (+ objeciones) — Diseño de los autos CON ACREENCIAS / VOTACIÓN

Insumo de diseño para construir (en sesión enfocada) los autos: **13 Fracaso**, **10 Acuerdo de pago**, **16 Bilateral**, y **11 Objeciones/Impugnación**. Extraído de los PDFs reales de Tejido Humano (sgcc/minutas) 2026-06-10.

## 🔑 Hallazgo clave: el motor de amortización YA EXISTE y está validado
`src/lib/solicitudes/payment-plan.ts`:
- `generarCronogramaFrances({capital, tasaMensualPct, numeroCuotas, mesesGracia})` → `[{cuota, mes_relativo, cuota_total, intereses, amortizacion, saldo}]`. **Reproduce EXACTO** las cifras del doc #10 (BBVA: capital $115.168.840, 8% EA, 84 cuotas → cuota $1.779.070 ✅; interés cuota 1 $741.087 ✅).
- `tasaEAAMensual()` (línea 27) + `eaANMV()` en HerramientaAcreencias (línea 204): **CRÍTICO** — capturar la tasa como **EA** y convertir a NMV con estas funciones. NO usar el "0.64%" rotulado literal (da cifra distinta). NMV exacta de 8% EA = (1.08)^(1/12)-1 = 0,64340%.
- También: `generarCronogramaProrrataQuinta()`, `generarCronogramaPrioridadPequenos()` (Art. 553 pequeños acreedores), `totalesDeCronograma()`.
- **Gaps a añadir (triviales):** aplicar % de QUITA al capital antes de amortizar (`capitalBase = con_capital * (1 - quita)`); mapear `mes_relativo` → etiqueta "jul-27" desde mes inicio; soportar última cuota distinta (#16).

## Reutilizables (NO reconstruir)
- Amortización: `payment-plan.ts`.
- Relación de acreencias + % voto: `src/lib/acreencias/pdf-relacion.ts`, `recalcular-porcentajes.ts`, `normalizarDocumento()` (HerramientaAcreencias 73-79, agrupa NIT con/sin dígito verificación).
- Votación: `src/lib/votacion/pdf-votacion.ts`, `docx-votacion.ts`, route `api/expediente/[id]/votacion/export`.
- Quórum + membrete + firmas + pie: del auto de suspensión (Fase 2a) — reusar patrón.

## Tablas (columnas exactas)
- **Relación definitiva (formato #10, completo):** `# | Acreedor (nombre+doc) | Clase | Capital | Int.corr | Int.mora | Seguros | Otros | Total | %Voto | Peq.` Agrupa por clase; acreedor con varios créditos = fila madre con subtotal + sub-filas sangradas (`>`); fila TOTALES (%Voto=100). Fuente: sgcc_acreencias con_*. Flag `variante: "completa"|"simple"`.
- **Relación simple (formato #13):** `Acreedores | Capital relacionado | Int.corr | Int.mora | Otros | Observaciones` (sin Seguros/Total/%Voto), por clase, fila TOTAL CAPITAL.
- **Amortización (#10):** `No.Cuota | Mes/Año | Valor Cuota | Intereses | Amortización | Saldo` + cabecera "VALOR CAPITAL $X". Francés. Por acreedor.
- **Votación aprobación (#10):** `# | Acreedor | Documento | Capital conc. | %Voto | Voto(A favor/Abstención/En contra) | Observaciones` + resumen (a favor/en contra/abstenciones/% aprobación). Regla: >50% capital Y ≥2 acreedores a favor → aprueba.
- **Votación fracaso (#13):** `Acreedores | Derecho voto % | Sentido(POSITIVO/NEGATIVO/AUSENTE)` por clase, TOTAL 100%. Mayoría negativa → fracaso.

## Desenlaces / RESUELVE (texto fijo verbatim — transcribir del PDF al construir)
- **Considerandos Art. 538 (4 supuestos)** — idéntico #10/#13 (persona natural no comerciante; cesación pagos 2+ obligaciones/2+ acreedores/90 días; >30% pasivo; ajustada Art. 539). Reusable.
- **#13 Fracaso RESUELVE:** PRIMERO declarar fracaso · SEGUNDO traslado a Juzgado Civil Municipal (Reparto) para liquidación patrimonial (Art. 563).
- **#10 Acuerdo aprobado:** "...APRUEBA dichas fórmulas de arreglo... el presente acuerdo hace tránsito a cosa juzgada y contra esta proceden los recursos del Art. 557 CGP." + Cláusula incumplimiento Art. 560 (bloque largo verbatim, pág 16-19) + Declaraciones del deudor (IV) + Cláusulas varias 1-8.
- **#16 Bilateral:** contrato Art. 553 num.3 / Ley 2445 / Dec. 1136. SIN membrete del centro (formato aparte "Página X de 5"). Tabla reconocimiento obligación (Concepto|Valor) + datos inmueble (matrícula/linderos — REQUIERE campos nuevos en el modelo) + condiciones de pago (monto/plazo/tasa EA/cuotas con última distinta). Excluido de liquidación (cláusula 7ª). Cláusulas 1,5,6,7,8,9,11,12 fijas verbatim.
- **#11 Objeciones/Impugnación** ("AUTO SUSPENSIÓN Y PRESENTACIÓN DE IMPUGNACIÓN"): ver `docs/autos/auto-objeciones-estructura.md` (extracción aparte). Reusa quórum + votación; lo propio = bloque de impugnación en 3 lugares (anuncio numeral 5 / fijación de términos numeral 6 / control legalidad SEGUNDO + RESUELVE PRIMERO). Plazos fijos: 5 días presentación + descorre, vencen 4:00 p.m., remisión a Juez Civil Municipal de Reparto. Solo aplica si hubo impugnación.

## Faseo recomendado (de menor a mayor riesgo)
1. **#13 Fracaso** (riesgo bajo, sin amortización) — valida toda la infra de tablas + RESUELVE.
2. **#10 Acuerdo de pago** (riesgo medio; el cálculo NO es el riesgo — ya validado; el trabajo es composición: N tablas de amortización por acreedor, quita, etiquetas de mes).
3. **#11 Objeciones** (votación + impugnación) y **#16 Bilateral** (formato aparte + campos de inmueble nuevos).

## Modelo de datos nuevo a evaluar (Fase 3)
- Inmuebles hipotecarios para #16 (matrícula, linderos, dirección) — no existe hoy.
- Parámetros de pago por acreedor (quita %, tasa EA, nº cuotas, mes inicio, día pago) — ¿ya en sgcc_propuesta_pago? Verificar antes de construir.
