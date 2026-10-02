# Execution Board — PDP Configurável AMMIS

| Task | Phase | Owner | Mode | Owned files | Dependencies | Status | Checkpoint | Commit |
|---|---|---|---|---|---|---|---|---|
| Contract closure | Preflight | ROOT | READ | implementation-contract.md | V2 contract | CLOSED | V2 ready; REV-001–028 resolved | none |
| Normalized safe payload and owned section form | 1–3 | ROOT (after writer stop) | WRITE | main-configurable-product.liquid; snippets/configurable-product-data.liquid; locales only if needed | contract; product-form.js | IMPLEMENTED | payload container, normalized references, owned native form | 4c29ace |
| State engine, generic steps, resolver, lifecycle and CSS | 2–3 | ROOT (after writer stop) | WRITE | configurable-product-initial.js; section-configurable-product.css | contract; section selectors | IMPLEMENTED | Node syntax/pure-function harness; browser pending | a3778c9 + ce2759f |
| Core/cart/accessibility hardening | 2–8, 11 | ROOT | WRITE | configurable-product-initial.js; section-configurable-product.css; main-configurable-product.liquid; configurable-product-data.liquid; locales; tests/configurable-product-core.test.js | contract; native product-form.js | PREVIEW_SYNCED | 8 Node tests; REAL_PRICE_STRATEGY fail-closed; preview checksums confirmed; browser and rendered Liquid payload pending | b27a520 |
| Baseline adversarial review | 1–3 | QA / REVIEW | READ | none | contract; protected files | CLOSED | baseline findings integrated; local limitations recorded | none |
| Root integration and validation | 1–3 | ROOT | WRITE | explicit phase paths only | implementation results | PREVIEW_SYNCED_PENDING_BROWSER | protected diff zero; preview `151273406566` read-only status clean and checksums matched b27a520; browser request/tooling pending; Theme Check unavailable locally | 4c29ace + a3778c9 + d7731fa + ce2759f + b27a520 |

Rules: one writer per file; no design.md, unrelated untracked files, protected PDP files, Shopify data, MAIN, commit push, or theme push outside an explicitly authorized preview checkpoint. Preview checkpoint target is unpublished theme 151273406566 only.

## Checkpoint de pausa — 2026-10-02 (histórico)

Estado: PAUSED / IMPLEMENTATION_PARTIAL. As marcações IMPLEMENTED acima indicam código existente, não aceite funcional nem conclusão do contrato. A revisão de baseline não equivale a uma revisão independente do código final.

- Repositório: `/home/ammis/ammis-moda`.
- Branch confirmada: `feature/product-configurator-v1`.
- HEAD e referência remota local `origin/feature/product-configurator-v1`: `b8d1adc1605a581caaa30b60e21c72281d70fd27`. Não houve fetch nesta operação.
- Antes deste checkpoint, nenhum arquivo rastreado estava modificado. Não rastreados preservados: `design.md`, `docs/configurable-pdp/implementation-contract.md`, `node_modules/`, `package-lock.json`, `package.json`.
- Contrato V2 local: `docs/configurable-pdp/implementation-contract.md`, 1981 linhas, 73046 bytes; ainda fora dos commits e, portanto, não disponível por clone da branch.
- Código alterado desde `6496871388c4c6c6169a847b89d8db8cc8430d3e`: `assets/configurable-product-initial.js`, `assets/section-configurable-product.css`, `sections/main-configurable-product.liquid`, `snippets/configurable-product-data.liquid`, `locales/en.default.json`, `locales/pt-BR.json`. O sétimo arquivo é este execution board.
- Diff baseline..HEAD confirmado vazio para `templates/product.json`, `sections/main-product.liquid`, `assets/product-form.js`, `layout/theme.liquid`, `snippets/product-configurator.liquid` e `assets/product-configurator.js`.

### Evidência anterior e limites

O registro anterior informa sincronização dos arquivos do preview `151273406566` até `ce2759f`, com checksums correspondentes. Essa evidência não foi reconsultada nesta pausa. Não implica validação visual ou funcional. O acesso HTTP anterior ao storefront retornou 429. MAIN: `149120614502`, fora do escopo.

As verificações anteriores de sintaxe Node, funções puras e JSON estático passaram, mas não há harness persistido. Theme Check ficou indisponível por dependência ausente. Permanecem sem evidência: JSON efetivamente emitido pelo Liquid, fluxo real no browser, carrinho, foco/teclado, responsividade e dispositivo real.

### Pendências prioritárias para retomada

1. Revisão independente do código final contra o contrato V2 antes de classificá-lo como pronto.
2. Validar em browser o handoff nativo corrigido: o listener de capture agora preserva a entrega ao `product-form.js`, assina eventos somente durante a tentativa e usa `source`/`productVariantId`.
3. Validar em browser o bloqueio de compra exigido por `REAL_PRICE_STRATEGY`: a implementação local mantém o CTA desabilitado e exibe a dependência de preço real.
4. Confirmar em preview o payload Liquid renderizado, foco/teclado, zoom, lifecycle e responsividade.
5. Com autorização já prevista pelo goal, sincronizar os arquivos finais somente no preview `151273406566`, mantendo MAIN e dados Shopify protegidos.

Na operação original do checkpoint, somente este documento foi editado. A frase sobre alterações locais e ausência de commit/push descreve o estado naquele momento da pausa; a retomada posterior está registrada no checkpoint abaixo.

## Checkpoint pós-hardening — 2026-10-02

Estado: PREVIEW_FILES_CONFIRMED / BROWSER_VALIDATION_PENDING.

- HEAD local e referência remota da branch `feature/product-configurator-v1`: `b27a520` (`fix: harden configurable PDP flow`); o push para `origin/feature/product-configurator-v1` foi concluído.
- A leitura GraphQL confirmou o tema de preview `151273406566` como `UNPUBLISHED`, sem `processing` e sem `processingFailed`. O tema MAIN `149120614502` permaneceu fora da operação.
- Os checksums MD5 do preview coincidem com a cópia local para: `assets/configurable-product-initial.js`, `assets/section-configurable-product.css`, `sections/main-configurable-product.liquid`, `snippets/configurable-product-data.liquid`, `locales/en.default.json`, `locales/pt-BR.json` e `templates/product.product-configuravel-main.json`.
- O preview respondeu `NOT_FOUND` somente para `templates/product.configuravel.json`; a template alternativa mantida e sincronizada é `templates/product.product-configuravel-main.json`. Nenhum arquivo foi removido ou renomeado.
- Verificações locais da retomada: 8 testes Node passaram; sintaxe JS, JSON estático, referência da seção, `git diff --check` e auditoria de seletores passaram. Theme Check continua indisponível por dependência local ausente. Browser real e payload Liquid renderizado continuam sem evidência por limitação de ambiente.
