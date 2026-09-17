# Auditoría de completitud — spec Chronos v0.3 → v0.4

*2026-09-14 · criterio: `gs/generative-specification/docs/spec-completeness.md` (derivabilidad por un
lector sin estado). Fase 0 del experimento "GS construye Chronos desde su spec". Resultado: v0.4 en
`chronos-git-history-graph.md`; Praxis extraído a `praxis-behaviour-axis.md`.*

## Veredicto en una línea

La v0.3 era una spec de **decisión** (justifica por qué construir) mejor que una spec de **derivación**
(cierra qué construir). Identidad, límites, contratos duros y la columna de honestidad estaban completos.
Faltaban: el stack, la forma de la respuesta, el ciclo de vida del grafo, la definición concreta de tres
de las cuatro métricas, los umbrales de los gates, y los tests-as-spec. Un constructor sin contexto
habría adivinado en 25 lugares. Cada uno está abajo como specification-query, con la restricción que lo
cierra en v0.4.

## (a) Specification-queries — dónde adivinaría un lector sin estado

| # | dónde adivinaba | query (la restricción que faltaba) | cierra en |
|---|---|---|---|
| 1 | Stack: lenguaje, runtime, SDK, cómo se lee git (libgit2, isomorphic-git, subprocess) | ¿En qué se construye y con qué lee el repo? | D1, C5 |
| 2 | Set de acciones: ¿hay `index`? ¿`status`? ¿`stats`? R1 solo dice "action-routed" | ¿Cuál es el conjunto cerrado de acciones? | R1 |
| 3 | Ciclo de vida del grafo: explícito (como CodeSeeker C4) o al primer query | ¿Quién dispara la construcción y cuándo se refresca? | R12, D4 |
| 4 | Persistencia: en memoria, `.chronos/` en el repo, cache de usuario | ¿Dónde vive el grafo entre procesos? (y C3 prohíbe escribir en el working tree) | D3, C3 |
| 5 | Identificación del repo: parámetro por llamada, env var, config al arrancar | ¿Cómo se nombra el repositorio y qué pasa con un subdirectorio? | R15 |
| 6 | Identidad de autor: `%an` vs `%aN` (mailmap), autor vs committer, filtrado de bots | ¿Qué identidad declarada se usa y se permite alguna fusión propia? | R16 |
| 7 | Métrica de `owners`: R5 pide "una métrica declarada" pero no la fija (count, recency, líneas) | ¿Cuál es la métrica y cómo se desempata? | R5, D5 |
| 8 | `owners` sobre directorio: ¿recursivo? | ¿Un path de directorio agrega lo que hay debajo? | R5 |
| 9 | Ventana de `cochange`: commits o tiempo, default, máximo, cap de resultados | ¿Qué acota la ventana y cómo se ve el denominador? | R6 |
| 10 | Commits enormes (reformats) en `cochange`: filtrar o no | ¿Se filtra por tamaño? (heurística → §6 dice benchmark antes) | R6 |
| 11 | Tratamiento de merges: R9 exige "declararlo" pero no fija la regla | ¿Merges cuentan en owners/cochange? ¿aparecen en history/why? | R9, D6 |
| 12 | Orden de `history` (R7 fija oldest-first para `why`; R4 no fija nada) | ¿Newest o oldest first? | R4 |
| 13 | Diferencia real `history` vs `why` (ambas devuelven commits de un archivo) | ¿Qué campos distinguen a cada una? | R4, R7, §4.3 |
| 14 | `why`: formas de referencia (`#123`, `ADR-0002`, `ABC-123`, paths) | ¿Qué cuenta como "issue o ADR referenciado"? | R7 |
| 15 | `why`: cuerpo del mensaje incluido o solo subject | ¿Va el body? (ahí vive el porqué) | R7 |
| 16 | `why` por rango de líneas: cómo se pide y qué se responde | ¿Parámetros del rango y eco en la respuesta? | R7, §4.1 |
| 17 | Forma de la respuesta: R13 dice "no prosa" pero no da schema ni nombres de campo | ¿Cuál es el envelope y las filas por acción? | R13, §4.3 |
| 18 | Paginación / tamaño: un archivo con 5.000 commits | ¿Hay `limit`, default, máximo, y se ve el truncado? | R17 |
| 19 | Formato de fecha y de sha | ¿ISO-8601? ¿sha corto? | R4 |
| 20 | Paths en Windows: separador, mayúsculas | ¿Forward slash siempre, case como git lo registra? | R10 |
| 21 | Staleness (R12): "cuánto atrás" — commits o tiempo; qué pasa tras rebase/force-push | ¿Qué es "behind" y qué pasa si el sha indexado ya no es ancestro? | R12 |
| 22 | Forma de los errores: JSON-RPC error, `isError`, salir del proceso | ¿Cómo ve el modelo un rechazo? | R18 |
| 23 | Invocación de git: shell string vs argv; paths que empiezan con `-` | ¿Inyección y flags por path están cerrados? | R19 |
| 24 | Shallow clones, worktrees, submódulos | ¿Están en alcance y cómo se marca la historia truncada? | §2, R20 |
| 25 | R11: "exists with no commits" — qué caso es (untracked en disco) | ¿Cuáles son los tres estados de un path? | R11 |
| 26 | Umbrales de gates: §5 dice "thresholds" sin número; TDD-order advisory en el template | ¿Cuánto es cobertura, mutación, complejidad, y qué bloquea? | §6 |
| 27 | Oráculo `chronos-bench.js` depende de tres repos locales en paths absolutos | ¿Qué corre en CI y qué corre local? (fixture sintético vs. repos reales) | §6, §9 |
| 28 | Nombre de paquete, bin, licencia | (abiertas) | D7, D8 |
| 29 | Layout: nombres de carpetas que griten el dominio (`git/`, `graph/`, `mcp/`) y dirección de dependencias | ¿Qué capas hay y quién puede importar a quién? | §6 (boundaries) |

## (b) Decisiones que se cerraron (van a ADR en el repo de Chronos) y las que quedan para JC

Cerradas con default y su porqué: **D1** stack · **D2** una tool / cuatro acciones · **D3** grafo en
memoria, sin persistencia · **D4** construcción al primer query + refresh incremental visible · **D5**
métrica de owners · **D6** merges.

Las dos que más merecen tu mirada porque son las que un constructor podría "mejorar" sin darse cuenta:

- **D3/D4 (memoria + lazy) vs. el precedente de CodeSeeker (index explícito + persistencia).** Elegí
  distinto de CodeSeeker y lo justifico en la tabla: la economía es otra (122 ms vs. embeddings). Si
  preferís simetría con CodeSeeker, R12 y §4.1 cambian (aparece la acción `index`).
- **TDD-order como gate bloqueante** (el template lo tiene advisory). Lo subí porque el prompt de
  construcción dice "el harness verifica" y ese es el momento de video. Si molesta en la práctica, baja
  a advisory con una decisión registrada.

Abiertas: **D7** nombre de paquete/bin · **D8** licencia (default Apache-2.0 como CodeSeeker).

### Addendum 2026-09-15 — respuesta de JC, tres decisiones más

**D11 — TDD confirmado, y afilado: contrato primero, después rojo, después verde.** El gate de §6 queda
bloqueante y ahora exige que el test rojo afirme un contrato ya escrito (§4.3 / probe de §9), no cualquier
test. El orden de commits es además el artefacto que lee el devlog.

**D9 — Chronos construye su propio grafo; sin librería compartida ni dependencia de CodeSeeker.**
Preguntado: ¿grafo propio, o una librería ("CodeSeeker light") que usen los dos? Verificado en el código
antes de responder:

- `GraphNode.type` de CodeSeeker (`src/storage/interfaces.ts:112`) es
  `file|class|function|method|variable|import|export`; `GraphEdge.type` es `imports|exports|calls|…`.
  Chronos necesita nodos `commit` y `author` y aristas `authored|touched|parent`: **ninguno existe**.
  Compartir = ensanchar las uniones de un paquete publicado para un consumidor que todavía no existe, o
  guardar commits como `properties` sin tipo, que es tirar justo lo que hace valioso al grafo declarado.
- `IGraphStore` es async en 15 métodos, scoped por `projectId`, con `flush()`/`close()` para SQLite y
  Neo4j. D3 son tres `Map` en memoria. Se implementarían 15 métodos para usar 3.
- Una abstracción se extrae de **dos implementaciones que andan**. El segundo candidato es Praxis, con
  volumen no acotado (su §8.4) contra los mapas chicos de Chronos: una abstracción sobre ambos no le
  serviría bien a ninguno. **Se reabre en el gate de evidencia de Praxis.**
- Para el experimento: una dependencia de internals de CodeSeeker obliga al constructor a cargar contexto
  de CodeSeeker, y la Fase 1 deja de ser una derivación desde la spec. Es el claim del video.

**Corrección de premisa (la pregunta traía "modelos CPU-optimized").** Chronos no necesita modelo alguno:
los embeddings resuelven *retrieval* (CodeSeeker usa `@huggingface/transformers`), y toda arista que
Chronos devuelve la **declara** git. C5 ahora lo dice como contrato: sin modelo, sin embedding, sin vector
store. La pregunta de modelos es real pero es sobre CodeSeeker-light, no sobre Chronos.

**D10 — la composición pasa por el path, no por código compartido.** Los tres servidores comparten la
clave `path repo-relativo` (R10). La pregunta compuesta se responde con tres traversals que el modelo une.
El acoplamiento que daría una librería, el contrato ya lo da gratis.

**Abierto, deliberadamente fuera de alcance de esta auditoría:** si CodeSeeker-MCP quedó superado por GS
(sentinela + puente), ¿cuál es su *residuo durable*? Precedente: ForgeCraft se deprecó y su residuo fue
`gate-template.md` — la disciplina portable, no el runtime. Lectura preliminar: el residuo de CodeSeeker
son sus ADR medidas (0002, 0012, 0014) y `mcp-surface.js`, no la capa de storage. Merece su propia
decisión; no bloquea Chronos.

## (c) Contratos agregados

- **§4.3 envelope + filas por acción** — el contrato público; renombrar un campo es breaking (ADR-0012).
- **§9 tests-as-spec (P-01…P-20, P-C1/C3/C4)** — un probe por MUST, sobre un fixture git construido por
  los tests (determinista) más el oráculo real. Antes, los únicos "tests" eran las 21 preguntas del
  bench, que no cubren contratos ni rechazos.
- **C5** (dependencias runtime = SDK; sin librería git) — cierra el query #1 por el lado de la
  supply chain, que la rúbrica no mide (Field Guide: "specify it anyway").

## (d) Sobre-especificación recortada o movida

- **R8 (v0.3) llevaba el cómo**: `--follow`, `--name-status -M`, `--format`. Son flags de git, no
  requisitos. Quedó el requisito (rename visible con `previous_path`) y el incidente se convirtió en el
  probe P-08 sobre el repo real (6 commits, `codemind` presente). Los flags viven en el bench y en el EDR
  que escriba el constructor.
- **§8 Praxis (130 líneas)**: no es sobre-especificación sino falta de acotación — el constructor de
  Chronos no tiene que cargarlo. Extraído verbatim a `praxis-behaviour-axis.md`; §11 apunta.
- **§7 (evidencia)**: se mantuvo como registro (§10) pero condensado; ya no lleva el bloque de "qué debe
  ser cierto antes" porque ya fue cierto. Si alguien reabre la adopción, el bench sigue siendo la fuente.
- **No recorté** los paréntesis de rationale (R1, R3, R14, C1): son el "porqué" auditable, no el cómo,
  y son cortos.
- **No agregué** módulo/ESM-CJS, test runner, layout de carpetas de código, formato interno del grafo:
  eso es el cómo y el constructor lo deriva (ADR-000 y EDRs en su repo).

## Qué queda para el constructor (Fase 1) y ya no debería adivinar

Sentinela, ADR-000 (materializa D1–D6), features F-001…F-004 (history/owners/cochange/why) con sus
criterios tomados de R4–R7 + envelope, gates de §6 cableados antes del primer `feat:`, fixture de §9, y
el port del oráculo. Todo lo demás es su cómo.

## Nota de honestidad

Los defaults de D1–D6 y los umbrales de §6 los elegí yo en esta auditoría con el porqué al lado; no son
medidos. El único número medido en la spec es el de §10 (bench del 2026-09-12). El humano cierra la
spec: si un default no te convence, cambialo antes de la Fase 1, no durante.

### Addendum 2026-09-15 (2) — spec v0.5, todas las decisiones cerradas

**D3/D4 confirmadas** (grafo en memoria, construcción al primer query, refresh visible). Se agregó **R21**:
la respuesta lleva `build_ms` cuando construyó o extendió el grafo, y el probe P-21 lo fija. El motivo es
de método, no de performance: D3 difiere la persistencia apoyándose en *una* medición (122 ms sobre 331
commits), así que el trigger para reabrirla tiene que ser medible. Una decisión cuyo disparador de revisión
no se mide es una decisión que nadie va a revisar.

**D7 cerrada** — `@pragmaworks/chronos`, bin `chronos`. El scope esquiva la lotería del nombre suelto en
npm. Queda registrado lo incómodo: `chronos` y `chronicle` son dos servidores de PragmaWorks a dos letras
de distancia, se cargan juntos, y los dos responden "qué pasó" (uno el git, el otro la sesión). Renombrar
ahora costaría spec + `chronos-bench.js` + prompt + título de la serie, así que **R2 pasa a exigir la
desambiguación** en sus 400 caracteres. Que quede como decisión y no como descuido es la mitad del valor.

**D8 cerrada** — Apache-2.0, igual que CodeSeeker.

**D12 — repo público desde el primer commit.** La serie ofrece el historial como evidencia, así que el
historial tiene que ser alcanzable; publicar al final invita a ordenar antes de subir, que es justo lo que
destruye la prueba. Es la única decisión de esta tanda **no reversible**: un historial publicado queda
cacheado e indexado aunque después se baje el repo.

**D13 — la spec canónica se muda con el build.** En el primer commit, `mcp/chronos/docs/spec.md` pasa a ser
fuente única y la copia de CodeSeeker queda como puntero de una línea. En CodeSeeker se quedan solo este
informe (documenta su bench y sus ADR) y `praxis-behaviour-axis.md`. Dos copias vivas divergen, y esa
divergencia es exactamente ADR-0012: un refactor que no tocó documentos dejó README, guías de instalación,
plugin y CLI describiendo una API removida durante dos releases. La lección ya está pagada.

**Sobre CodeSeeker (cierra la pregunta abierta del addendum anterior).** Decisión de JC: **CodeSeeker
queda.** GS lo vuelve menos necesario — sentinela y puente cubren buena parte de lo que resolvía — pero
mientras GS o algo equivalente no sea estándar, sigue teniendo valor, y su costo de mantenerlo vivo es
bajo. No se deprecia ni se extrae residuo. Esto **confirma** el §2 de la spec de Chronos, que manda la
búsqueda semántica sobre mensajes de commit a CodeSeeker: ese out-of-scope apunta a algo que existe.
