## Ideias
1. Remover logica do periodo: https://github.com/DeviaVir/zenbot/issues/1827 -> FEITO, TESTANDO
2. Criar opção de apenas comprar --only_buy -> DESCARTADO
3. Criar opção de atuar somente na alta ou na baixa s.tend
4. Criar opção de sem sinal em caso de conflito de sinal para multiplas estrategias como mmf -> FEITO
5. Resolver bug do --max_slippage_pct que cancela a venda no caso do preço subir, verificar na compra
6. Entender melhor o profit stop e talvez voltar o código anterior
7. Desenvolver para nova exchange, iqoption ? br ? forex ?
8. Aumentar o profit stop na mmf r para 1% ?
9. Desenvolver novas estrategias
    - Converter estrategias do gekko
    - Desenvolver uma estrategia com base em machine learning
    - Arrumar forex analytics -> FEITO
10. Desenvolver estrategia para mercado muito liquido -> FEITO, A TESTAR
11. Desenvolver quarentena para buy(cancel buy) baseado no time do último loss -> FEITO, TESTANDO
12. Desenvolver limite de buy baseado em alguma logica -> FEITO -> --deposit
