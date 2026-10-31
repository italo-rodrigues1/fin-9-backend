# P0 — Regras financeiras

- [x] Criação, edição e exclusão atômicas de lançamentos e seus saldos.
- [x] Isolamento serializável com até três tentativas para conflitos P2034.
- [x] Resumos com Decimal, preservando precisão de centavos.
- [x] Filtros mensais/anuais em UTC com fim exclusivo, incluindo viradas de ano e ano bissexto.
- [x] Dez testes novos cobrindo invariantes de saldo, rollback, precisão, datas, repetição de edições e conflitos simulados.
- [x] Suíte completa: 53 testes passaram; build NestJS passou.

Os testes usam cliente Prisma simulado. Concorrência contra PostgreSQL real e homologação em aparelho não foram executadas neste ambiente. O registro das entregas de interface fica em fin-9-mobile/docs/p0-validation.md e o checklist geral em project.md, na pasta que reúne os serviços.
