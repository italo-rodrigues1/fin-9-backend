# P0 — Regras financeiras

- [x] Criação, edição e exclusão atômicas de lançamentos e seus saldos.
- [x] Isolamento serializável com até três tentativas para conflitos P2034.
- [x] Resumos com Decimal, preservando precisão de centavos.
- [x] Filtros mensais/anuais em UTC com fim exclusivo, incluindo viradas de ano e ano bissexto.
- [x] Dez testes novos cobrindo invariantes de saldo, rollback, precisão, datas, repetição de edições e conflitos simulados.
- [x] Suíte completa: 56 testes passaram; build NestJS passou.

Os testes usam cliente Prisma simulado. Concorrência contra PostgreSQL real e homologação em aparelho não foram executadas neste ambiente. O registro das entregas de interface fica em fin-9-mobile/docs/p0-validation.md e o checklist geral em project.md, na pasta que reúne os serviços.

## Correção após teste Android — 31/10/2026

- [x] Ajustar limite geral para 120 requisições/minuto por rota, mantendo login/cadastro em 5 tentativas/minuto.
- [x] Corrigir classificação do HTTP 429 para Too Many Requests no filtro de exceções.
- [x] Compartilhar consultas simultâneas e reutilizar leituras por 10 segundos no aplicativo.
- [x] Invalidar leituras após gravações e logout; atualização manual força nova consulta.
- [x] Remover consulta de resumo ainda sem uso e painéis de erro repetidos no Dashboard.
- [x] Validar limites com controladores reais e repositórios simulados: 120 leituras de contas permitidas, a seguinte retorna 429 com Retry-After; 15 consultas mensais permitidas; sexta tentativa de login bloqueada.
- [x] Testes: 56 no backend e 13 no mobile; TypeScript, lint dos arquivos de backend alterados e build NestJS.
- [ ] Revalidar navegação Android após instalar/recarregar a versão corrigida.
