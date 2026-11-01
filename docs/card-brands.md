# Bandeiras de cartão

`POST /cards` e `PATCH /cards/:cardId` aceitam `brand` com um destes valores:
`VISA`, `MASTERCARD`, `ELO`, `AMERICAN_EXPRESS` ou `HIPERCARD`.

O campo é opcional para preservar a compatibilidade com clientes e cartões
anteriores. Um valor omitido na edição mantém a bandeira atual; `null` remove a
informação. Não se presume a bandeira pelo nome do cartão. Lista, detalhes e
consulta de fatura devolvem o campo persistido. O aplicativo oferece um select
no cadastro e na edição e mostra a bandeira no card.

A migration aditiva `20261101020000_card_brand` cria o enum `CardBrand` e uma
coluna nullable em `credit_cards`, sem atribuir bandeira aos cartões existentes.
Antes de iniciar o backend atualizado em outro ambiente, executar:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
```

Validação: testes de DTO para as cinco bandeiras, ausência/null e valores
inválidos; integração no PostgreSQL local cobre criação, edição, listagem,
detalhes, preservação do valor omitido e remoção explícita.
