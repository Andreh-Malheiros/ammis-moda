# Execution Board — PDP Configurável AMMIS

| Task | Phase | Owner | Mode | Owned files | Dependencies | Status | Checkpoint | Commit |
|---|---|---|---|---|---|---|---|---|
| Contract closure | Preflight | ROOT | READ | implementation-contract.md | V2 contract | CLOSED | V2 ready; REV-001–028 resolved | none |
| Normalized safe payload and owned section form | 1–3 | ROOT (after writer stop) | WRITE | main-configurable-product.liquid; snippets/configurable-product-data.liquid; locales only if needed | contract; product-form.js | IMPLEMENTED | payload container, normalized references, owned native form | 4c29ace |
| State engine, generic steps, resolver, lifecycle and CSS | 2–3 | ROOT (after writer stop) | WRITE | configurable-product-initial.js; section-configurable-product.css | contract; section selectors | IMPLEMENTED | Node syntax/pure-function harness; browser pending | a3778c9 + ce2759f |
| Core/cart/accessibility hardening | 2–8, 11 | ROOT | WRITE | configurable-product-initial.js; section-configurable-product.css; main-configurable-product.liquid; configurable-product-data.liquid; locales; tests/configurable-product-core.test.js | contract; native product-form.js | PREVIEW_SYNCED | 15 Node tests; generic step contract; cached image index; REAL_PRICE_STRATEGY and cart bridge fail-closed; zoom isolation; rendered Liquid payload confirmed; browser interaction pending | b27a520 + 246c2fe + 8d72a5b + 01e3819 |
| Baseline adversarial review | 1–3 | QA / REVIEW | READ | none | contract; protected files | CLOSED | baseline findings integrated; local limitations recorded | none |
| Root integration and validation | 1–3 | ROOT | WRITE | explicit phase paths only | implementation results | RENDERED_PAYLOAD_CONFIRMED / BROWSER_INTERACTION_PENDING | protected diff zero; preview `151273406566` remains unpublished; Aurora HTML/payload rendered with HTTP 200; source maps match local JS/CSS; browser interaction and Theme Check remain unavailable locally | 4c29ace + a3778c9 + d7731fa + ce2759f + b27a520 + 246c2fe + 8d72a5b |

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

- HEAD local e referência remota da branch `feature/product-configurator-v1`: `246c2fe` (`fix: preserve configurable modal scroll position`), após o hardening anterior `b27a520`; os pushes para `origin/feature/product-configurator-v1` foram concluídos.
- A leitura GraphQL confirmou o tema de preview `151273406566` como `UNPUBLISHED`, sem `processing` e sem `processingFailed`. O tema MAIN `149120614502` permaneceu fora da operação.
- Os checksums MD5 do preview coincidem com a cópia local para: `assets/configurable-product-initial.js`, `assets/section-configurable-product.css`, `sections/main-configurable-product.liquid`, `snippets/configurable-product-data.liquid`, `locales/en.default.json`, `locales/pt-BR.json` e `templates/product.product-configuravel-main.json`; JS/CSS foram revalidados após `246c2fe`.
- O preview respondeu `NOT_FOUND` somente para `templates/product.configuravel.json`; a template alternativa mantida e sincronizada é `templates/product.product-configuravel-main.json`. Nenhum arquivo foi removido ou renomeado.
- Verificações locais da retomada: 8 testes Node passaram; sintaxe JS, JSON estático, referência da seção, `git diff --check` e auditoria de seletores passaram. Theme Check continua indisponível por dependência local ausente. Browser real e payload Liquid renderizado continuam sem evidência por limitação de ambiente.
- O hardening `246c2fe` passou sintaxe/testes e preserva a posição de scroll ao abrir/fechar o dialog, com ref-count para múltiplas instâncias; a validação browser desse comportamento continua pendente.
- Aceitação transitória baseada em leitura Admin GraphQL atual: normalização pelas funções reais retornou `valid=true`, 3 grupos com 3 opções cada, 5 variantes (`34`, `36`, `38`, `40`, `42`), 40 image states, `startingPriceCents=146700`, acréscimos selecionados `50000` e total estimado `196700`. Essa prova usa dados Shopify adaptados em memória e não substitui o payload Liquid renderizado no preview.

## Checkpoint QA hardening — 2026-10-02

Estado: QA_FIXES_PREVIEW_SYNCED / BROWSER_VALIDATION_PENDING.

- O review read-only encontrou lacunas de imagem de revisão, anúncio/foco de validação, shape dos steps, reuso do índice de imagens, metadados responsivos, bridge de carrinho e isolamento do zoom; todas foram corrigidas no código autorizado e cobertas por 10 testes Node.
- Commit da correção: `8d72a5b` (`fix: close configurable PDP QA gaps`), enviado para `origin/feature/product-configurator-v1`.
- O preview autorizado `151273406566` recebeu somente `assets/configurable-product-initial.js` e `assets/section-configurable-product.css`, via `theme push --theme 151273406566 --nodelete --only ...`; retorno do CLI: upload concluído.
- Leitura GraphQL posterior confirmou `role=UNPUBLISHED`, `processing=false`, `processingFailed=false`, `userErrors=[]`; os MD5 locais e remotos coincidem: JS `722ad65d40b3d151d50c568b9a0086d4`; CSS `77635b45d73e5bb9db9b7a6761b770bd`.
- Não há evidência de browser, console, rede, payload Liquid renderizado ou teste visual porque o storefront respondeu `429`, não há ferramenta/browser utilizável neste ambiente e o Theme Check não produziu saída antes de timeout; o validador local também carece de `@shopify/theme-check-common`.

## Auditoria de disponibilidade browser/renderização — 2026-10-02

Estado: EXTERNAL_RENDERING_BLOCKED / CODE_UNCHANGED.

- O único Chromium local disponível é o Playwright Chromium; `ldd` confirmou bibliotecas ausentes (`libnspr4`, `libnss3`, GTK, Cairo, Pango, entre outras). Nenhuma dependência foi instalada.
- O endpoint `myshopify.com` redireciona para `ammismoda.com.br`; os headers reconhecem `theme=151273406566`, mas a resposta final não entrega o HTML renderizado e as tentativas com `-L` retornam `429`.
- O leitor web externo marcou a URL do preview como inacessível. `shopify theme dev` não foi executado porque faria upload inicial/reconciliação do tema inteiro e não seria uma validação read-only restrita.
- Não houve alteração de código, Shopify, preview, MAIN ou arquivos protegidos nesta auditoria.

## Checkpoint de renderização do preview efêmero — 2026-10-02

Estado: RENDERED_PAYLOAD_CONFIRMED / BROWSER_INTERACTION_PENDING.

- `shopify theme preview --theme 151273406566 --overrides {}` gerou um preview efêmero sem upload do working tree e sem tocar no MAIN. URL retornada: `https://yi4jx9o5arp9ofydhntlm2kb5s6z4-63422333030.shopifypreview.com`.
- A rota da Aurora com `?view=product-configuravel-main` respondeu `HTTP 200`; o HTML referencia `main-configurable-product`, `assets/configurable-product-initial.js` e `assets/section-configurable-product.css` no preview.
- O payload emitido pelo Liquid foi extraído do container `data-configurable-payload` e validado com `JSON.parse`: `version=1`, `locale=pt-BR`, `currency=BRL`, produto configurável habilitado, 3 grupos com 3 opções, 5 variantes nativas (`34`, `36`, `38`, `40`, `42`), 40 estados de imagem e estado inicial com `selections=[]`.
- O payload exato renderizado foi passado pelo normalizador JS local: `valid=true`, sem erros, `startingPriceCents=146700` e acréscimos iniciais `0`; as opções usam `priceAdditionCents` e as variantes usam `priceCents`, sem hardcoding de título/opções no controller.
- O HTML renderizado contém imagem inicial, nome da Aurora, título `Personalize sua peça`, `A partir de`, resumo de acréscimos e a sequência de etapas. O CTA inicial é `Personalizar`; a marcação do botão começa desabilitada até a inicialização do controller, mantendo o fail-closed quando a configuração não está disponível.
- Os assets minificados servidos pelo CDN têm tamanho/checksum diferentes por transformação de entrega; os source maps do preview foram lidos sem escrita e seus `sourcesContent` têm MD5 idêntico aos arquivos locais: JS `722ad65d40b3d151d50c568b9a0086d4` e CSS `77635b45d73e5bb9db9b7a6761b770bd`.
- Esta prova confirma renderização server-side e contrato do payload, mas não substitui browser real: interação da etapa Tecido, foco/teclado, console, rede, responsividade e comportamento em dispositivo continuam pendentes devido às limitações de browser registradas acima.
- Nenhum arquivo do tema foi alterado nesta sondagem, nenhum dado Shopify foi escrito e nenhum tema foi publicado.

## Checkpoint de auditoria de conclusão — 2026-10-02

Estado: PREVIEW_RENDERED / INTERACTIVE_BROWSER_PENDING.

- O preview efêmero `vkju2kzviwsx6p4pxkday6p414o3a-63422333030` respondeu `HTTP 200` com User-Agent de navegador na rota `product-configuravel-main`.
- O smoke test sobre o HTML renderizado passou: payload JSON válido, Aurora com 3 grupos/3 opções, 5 tamanhos, 40 image states, seção própria, product form com ownership por `section.id`, scripts globais esperados e CTA de carrinho somente dentro do dialog/form oculto.
- O payload renderizado foi normalizado pelas funções reais com `valid=true`, sem erros e `startingPriceCents=146700`. Os source maps dos assets do preview continuam com MD5 idêntico aos arquivos locais.
- O harness local foi ampliado para 15 testes, cobrindo versão incompatível, grupo opcional vazio, seleção válida sem imagem, colisões/fallback de image state e variante indisponível; todos passaram.
- O browser real continua não executável neste ambiente por bibliotecas do Chromium ausentes. Portanto, interação, console, rede, foco/teclado, Theme Editor e viewport/dispositivo ainda não são evidência concluída.
- Na regressão do mesmo preview, `?view=product` respondeu com `main-product` e sem `data-configurable-pdp`; a URL sem `view` resolve atualmente para a template configurável no estado externo da Aurora. Essa atribuição não foi feita nem alterada nesta execução; a comparação normal usa explicitamente a template padrão.
- A inspeção estática dos scripts globais não encontrou referências a `data-configurable-*`; selectors de variantes/media usam classes e IDs convencionais ausentes da seção nova, cujo form usa `ConfigurableProductForm-SECTION_ID`. O risco de colisão global permanece dependente de browser para validação comportamental.
