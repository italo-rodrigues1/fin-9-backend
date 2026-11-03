# Validação de dependências de segurança

Auditoria realizada em 02/11/2026 com `npm audit --omit=dev --json`, comparando o `package-lock.json` anterior à implementação com o resultado final. A consulta usa o catálogo de advisories do npm e conta pacotes afetados, incluindo os que propagam alertas de suas dependências.

| Árvore de runtime             | Moderate | High | Critical | Total |
| ----------------------------- | -------: | ---: | -------: | ----: |
| Antes da implementação        |        8 |   16 |        1 |    25 |
| Depois das correções pontuais |        8 |   16 |        0 |    24 |

O resultado final não acrescenta pacotes vulneráveis à lista anterior. As correções foram limitadas às dependências novas da documentação e a um patch crítico já necessário na árvore original; não foi executado `npm audit fix` geral.

## Correções incluídas

| Pacote                                         | Versão final | Motivo                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proxy-addr`                                   | 2.0.8        | Corrige o advisory crítico de IP spoofing [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), presente antes da implementação.                                                                                                                                                                  |
| `browserslist`                                 | 4.29.5       | Corrige os advisories de consumo de memória e estatísticas não confiáveis [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) e [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g). A dependência passou a integrar a árvore de runtime pela distribuição local do Scalar. |
| `baseline-browser-mapping`                     | 2.11.35      | Corrige [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv), também alcançável na nova árvore transitiva do Scalar.                                                                                                                                                                              |
| `fast-uri`                                     | 3.1.9        | Aplica a série de correções de normalização de URI e confusão de host, incluindo [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc).                                                                                                                                                            |
| `js-yaml`, somente dentro de `@nestjs/swagger` | 5.5.0        | Corrige [GHSA-r3ph-w7gj-g6xm](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm). O Swagger 11.4.7 fixa a versão vulnerável 5.3.0; um override localizado mantém a compatibilidade com NestJS 11. Revisar esse override quando a linha 11 incorporar a correção.                                                      |

## Findings anteriores ainda presentes

Os 24 pacotes restantes já apareciam na auditoria da árvore original. Entre os grupos afetados estão NestJS e suas dependências (`@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/platform-express`, `body-parser`, `file-type`, `multer`, `path-to-regexp`, `qs` e `lodash`) e a árvore do Prisma CLI (`prisma`, `@prisma/config`, `@prisma/dev`, Hono, parsers e utilitários). O npm pode incluir peers do Prisma na consulta com `--omit=dev`; isso não significa que o aplicativo exponha as funcionalidades de desenvolvimento desses pacotes.

A atualização coordenada dessas árvores fica separada desta implementação. Os alertas do catálogo não demonstram, por si só, que os caminhos afetados sejam acionáveis pelas rotas do Fin-9. Para conferir o estado atual e os advisories completos:

```sh
npm audit --omit=dev
npm audit
```

As contagens podem mudar conforme novos advisories forem publicados. A auditoria de composição complementa os testes de autenticação, autorização, validação dos contratos e isolamento RLS.
