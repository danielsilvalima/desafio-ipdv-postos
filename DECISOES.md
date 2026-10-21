# Decisões técnicas

Este documento explica as escolhas feitas no projeto, os trade-offs de cada uma e o que eu faria em seguida. O ponto de partida foi uma análise do arquivo `modelo importação desafio.csv`, porque a maior parte das decisões vem dos problemas reais que ele tem.

## 1. O que o arquivo fornecido mostrou

- UTF-8 com BOM, separado por `;`, quebra de linha CRLF, 21 colunas e 100 linhas.
- **CNPJ em notação científica** em todas as linhas (`1,02346E+13`). É o efeito clássico do Excel ao tratar a coluna como número.
- **CEP com 7 dígitos** em 10 linhas, todas de São Paulo e Guarulhos (`1310100`, `7010127`). São CEPs que começam com 0, e o Excel apagou o zero.
- **CPF e CNPJ fictícios:** quase nenhum passa no dígito verificador.
- Responsáveis repetidos: 20 pessoas para 100 postos.
- `combustiveis` é uma lista separada por vírgula, com 7 valores distintos.
- `observacoes` tem espaços sobrando no fim de algumas linhas.

## 2. Modelagem

Tabelas normalizadas, com SQL puro nas migrations (`backend/db/migrations`):

- `bandeiras` e `combustiveis`: catálogos com índice único em `normalizar_nome(nome)`. Essa função remove acentos, caixa e espaços extras, de modo que "Raízen", "raizen" e " RAÍZEN " são a mesma bandeira. A extensão `unaccent` não é `IMMUTABLE`, então a função fixa o dicionário para poder ser usada em índice.
- `responsaveis`: identificados pelo CPF, porque o mesmo responsável aparece em vários postos.
- `postos`: identificados pelo CNPJ (único), com chaves estrangeiras para bandeira e responsável.
- `posto_combustiveis`: relação N:N com uma coluna `ordem`, para que a exportação devolva os combustíveis na mesma ordem em que vieram.
- `importacoes` e `importacao_linhas_rejeitadas`: histórico de cada execução e as linhas recusadas, guardadas **exatamente como vieram** (`jsonb`). É isso que permite gerar o arquivo de correção a qualquer momento, inclusive de importações antigas.

Detalhes que valem destacar:

- **CNPJ, CPF e CEP são texto** (`char(14)`, `char(11)` e `char(8)`), com `CHECK` de "só dígitos". Tipo numérico perderia o zero à esquerda, que é justamente o problema que o arquivo já tem.
- UF, status e contagens têm `CHECK` no banco, além da validação na aplicação. Se um bug passar pela validação, o banco recusa.
- `numero` é texto, para aceitar "S/N" e "1200-A".

## 3. CNPJ, CPF e CEP sem completar zeros

O sistema **nunca completa** CNPJ, CPF ou CEP com zeros à esquerda. Vale exatamente o que está na coluna:

- CNPJ precisa ter 14 dígitos, CPF 11 e CEP 8 (a máscara é aceita e removida);
- com menos ou mais dígitos, a linha é recusada.

Completar zeros seria adivinhar um documento. Na maioria dos casos o palpite acertaria, mas quando errasse o sistema gravaria silenciosamente um dado errado, e esse dado é a chave do posto. Preferi deixar a correção explícita para quem é dono da planilha.

A mensagem de erro explica a causa mais provável e como resolver: "O Excel costuma apagar o zero do começo quando a coluna está formatada como número. Formate a coluna como Texto e digite o CEP completo, por exemplo 01310100, ou use a máscara 01310-100."

**Consequência no arquivo fornecido:** 10 linhas são recusadas por CEP com 7 dígitos. É o resultado esperado, e essas linhas servem de demonstração real da correção guiada (seção 8).

## 4. CNPJ e CPF sem dígito verificador

A importação confere só a quantidade de dígitos, sem validar o dígito verificador. Os dados do arquivo são fictícios: com a validação ligada, praticamente toda a base de teste seria recusada e o sistema não teria o que mostrar.

As funções de dígito verificador existem (`validacao/documentos.ts`), estão cobertas por testes e não são chamadas na importação. Com dados reais, ligar essa validação seria o primeiro passo. Sequências só de zeros já são recusadas.

## 5. CNPJ em notação científica

`1,02346E+13` é convertido para `10234600000000`, e a linha recebe um **aviso** (não um erro) dizendo que parte dos dígitos pode ter se perdido no Excel. Nenhum dígito é inventado: a conversão só muda a forma de escrever o número que está na célula.

Por que aviso e não erro: recusar recusaria 100% do arquivo fornecido. Ao mesmo tempo, o dado não é confiável, porque o Excel arredondou o CNPJ para 6 dígitos significativos. Dois postos diferentes podem virar o mesmo número. Se isso acontecer no mesmo arquivo, o segundo aparece como "CNPJ repetido no arquivo" (seção 7), então o usuário vê o problema.

Num cenário real, esta é a pergunta que eu faria ao time antes de decidir: a planilha de origem pode ser exportada com a coluna como texto? Se puder, eu passaria a tratar notação científica como erro.

## 6. Reimportação segura: upsert pelo CNPJ

O CNPJ é a identidade do posto. A gravação usa `INSERT ... ON CONFLICT (cnpj) DO UPDATE`, então:

- reimportar o mesmo arquivo atualiza os postos e não duplica nada;
- o usuário pode importar só o arquivo de correção ou o arquivo completo de novo, e as duas formas funcionam;
- o relatório separa novos de atualizados usando `xmax = 0` no `RETURNING` (linha recém-inserida), sem uma consulta extra por posto.

Responsáveis seguem a mesma lógica, pelo CPF. Bandeiras e combustíveis desconhecidos são **cadastrados automaticamente** e aparecem no relatório como "novos cadastros". Assim o usuário percebe se um nome foi digitado errado (por exemplo "Etanoll").

## 7. Conflitos dentro do mesmo arquivo

- **CNPJ repetido:** vale a última ocorrência, como no Excel quando se edita de cima para baixo. As anteriores são ignoradas e geram aviso com o número da linha mantida.
- **Mesmo CPF com dados diferentes** (nome, e-mail ou cargo): vale a última ocorrência, com aviso nas outras linhas.
- **Combustível repetido na mesma célula:** entra uma vez só, com aviso.

Em todos os casos, a escolha foi não bloquear a linha e sim avisar. O dado chega, e o usuário sabe o que o sistema decidiu.

## 8. Importação parcial e correção guiada

O cenário que guiou o desenho: alguém importa uma planilha com centenas de linhas e parte delas tem erro.

- **Linhas válidas são gravadas, inválidas são recusadas.** Uma linha com CEP errado não impede as outras 400 de entrar. As válidas vão numa única transação: ou entram todas, ou nenhuma (em caso de falha técnica).
- **Erros que impedem ler o arquivo** (planilha `.xlsx`, cabeçalho sem colunas obrigatórias, arquivo vazio, aspas quebradas) não gravam nenhum posto. Mesmo assim, ficam no histórico com o motivo.
- **Cada erro vem de um catálogo único** no backend, com título, mensagem, dica e exemplo correto. A tela, o arquivo de correção e o histórico usam o mesmo texto.
- **Erros agrupados por tipo:** "CEP com quantidade de números errada, 10 linhas: 2, 4, 22…". Quem corrige uma planilha corrige uma coluna inteira de uma vez, não linha a linha.
- **Número de linha do Excel:** o cabeçalho é a linha 1. O número mostrado é o que o usuário vê na planilha.
- **Arquivo de correção:** só as linhas recusadas, com os valores originais, as mesmas colunas e uma coluna extra `erros_importacao` explicando cada problema. O importador ignora essa coluna, então o usuário corrige e importa o mesmo arquivo de volta, sem apagar nada.
- **Avisos separados de erros:** aviso não impede a linha de entrar (notação científica, linha repetida, coluna desconhecida no cabeçalho). Erro impede.

## 9. Leitura do arquivo

- Encoding: UTF-8, com fallback para Windows-1252 quando o arquivo não é UTF-8 válido. É o caso do "CSV (separado por vírgulas)" antigo do Excel.
- Separador `;`, `,` ou tabulação, detectado pelo cabeçalho (contando só o que está fora de aspas).
- O cabeçalho é comparado sem diferenciar caixa, acentos, espaços e hífens: "Nome Posto" e "NOME_POSTO" valem como `nome_posto`. Colunas obrigatórias ausentes bloqueiam o arquivo. Colunas desconhecidas geram aviso e a tela sugere que pode ser erro de digitação.
- Planilhas Excel (`.xlsx` e `.xls`) são reconhecidas pela assinatura do arquivo, e a mensagem explica como salvar como CSV.
- Datas aceitas: `dd/mm/aaaa`, `aaaa-mm-dd`, variações com `-` ou `.` e o número serial do Excel. Datas inexistentes (`31/02/2020`) e anos com 2 dígitos são recusados.
- Bairro, município, nome e cargo do responsável digitados todos em maiúsculas ou todos em minúsculas viram nome próprio: `CAMPINAS` e `campinas` são gravados como `Campinas`, e `SAO JOSE DOS CAMPOS` como `Sao Jose dos Campos`, com os conectivos (de, da, do, dos, das, e) em minúsculas. Sem isso, a listagem e a exportação mostrariam "Campinas" e "campinas" como se fossem cidades diferentes. Texto que já mistura maiúsculas e minúsculas é mantido como veio, porque a grafia foi uma escolha de quem digitou. Acentos não são acrescentados, para não adivinhar dado. Razão social, nome fantasia e logradouro ficam de fora, porque siglas como "LTDA", "ACM" e "SHN" se perderiam. Com mais tempo, o município viraria um cadastro com a tabela do IBGE, que daria a grafia oficial e permitiria conferir se o município pertence à UF.
- Limite de 20 MB por arquivo. Um CSV de 10 mil postos tem cerca de 3 MB.

## 10. Exportação em streaming

O requisito de 10 mil registros ou mais sem carregar tudo em memória levou a:

- `pg-query-stream`: cursor no PostgreSQL, lido em lotes de 500 linhas;
- `stream.pipeline` do Node, que respeita o backpressure: se o cliente baixa devagar, a leitura do banco espera;
- no frontend, o botão é um link direto (`<a href download>`), não uma chamada axios. O navegador grava o arquivo em disco conforme chega, sem montar um blob em memória.

Formato:

- Mesmas colunas e mesma ordem do modelo, para o arquivo voltar ao importador sem ajustes.
- UTF-8 com BOM, `;` e CRLF, que é o que o Excel em português abre direto.
- **CNPJ, CPF e CEP saem com máscara** (`01.234.567/0001-89`). Assim o Excel trata a coluna como texto e não apaga zeros nem converte para notação científica, que é exatamente o problema do arquivo original. O importador aceita a máscara.

Falhas:

- Se o banco cair antes de começar, a resposta é um erro JSON normal.
- Se a conexão cair no meio do download, a resposta é interrompida e a conexão com o banco é descartada em vez de voltar ao pool, porque o cursor ficou num estado incerto.

O teste de ida e volta exporta, reimporta e confere que nada mudou, com o arquivo fornecido e com 10 mil linhas.

## 11. Desempenho da importação

A gravação é feita em lotes de 1.000 linhas com `INSERT ... SELECT FROM unnest(...)`: uma consulta por lote, não uma por posto.

A primeira versão levava 5,5 s para reimportar 10 mil postos. A medição mostrou que o tempo ia quase todo para a lista de combustíveis: apagar e inserir de novo os vínculos de cada posto disparava uma checagem de chave estrangeira por vínculo. A versão atual compara a lista do arquivo com a do banco e grava só a diferença (apaga o que saiu, ajusta a ordem, insere o que entrou), uma vez para o arquivo inteiro. O tempo caiu para cerca de 2 s.

## 12. Listagem e busca

- Paginação no servidor (`v-data-table-server`), com ordenação por uma lista fechada de colunas. O nome da coluna nunca é interpolado a partir da entrada do usuário.
- A busca aceita várias palavras, e todas precisam aparecer em algum campo: `florianopolis repsol` encontra os postos Repsol de Florianópolis. Ignora acentos e caixa, e números também buscam no CNPJ.
- A busca usa `LIKE` sobre `normalizar_nome(...)`, sem índice. Para 10 mil postos responde rápido. Com uma base bem maior, o próximo passo seria um índice trigram (`pg_trgm`).

## 13. Frontend

- Telas: Postos, Importar, Histórico e detalhe de uma importação. O relatório é o mesmo componente logo após o envio e no histórico.
- Erros de API passam por um interceptor do axios que traduz para uma mensagem em português e mostra um aviso global. Telas que tratam o erro no próprio lugar (listagem, importação) desligam o aviso global por requisição, para a mensagem não aparecer duas vezes.
- Toda tela tem estado de carregando, vazio (com atalho para a próxima ação) e erro (com "Tentar novamente").
- Requisições de listagem antigas são canceladas (`AbortController`) quando o usuário digita na busca, para uma resposta atrasada não sobrescrever a mais nova.
- Usei só componentes estáveis do Vuetify. O `VFileUpload` ainda está em labs, então a área de envio é um componente próprio, com clique, arrastar e teclado.

## 14. Testes

- Vitest no backend: 180 testes, entre unitários (validadores, leitura do CSV, cabeçalho, preparação) e de integração pela API com Supertest.
- Os testes de integração rodam contra **PostgreSQL real** num banco separado (`postos_test`), não contra mocks. Upsert, `ON CONFLICT`, `unaccent`, streaming e transações são justamente o que precisa ser testado, e um mock não pegaria erro de SQL.
- O banco de teste só é aceito se o nome terminar em `_test`, porque as tabelas são limpas a cada teste.

## 15. Limitações e próximos passos

- **Autenticação:** não há login. Numa ferramenta interna real, seria o primeiro item.
- **Injeção de fórmula no CSV:** um valor começando com `=`, `+`, `-` ou `@` é exportado como veio, e o Excel pode interpretá-lo como fórmula. A proteção usual (prefixar com `'`) quebraria a ida e volta, porque o valor reimportado viria com o apóstrofo. A solução seria aplicar o prefixo na exportação e removê-lo na importação.
- **Arquivos maiores que 20 MB:** a leitura hoje carrega o arquivo inteiro em memória. Para arquivos bem maiores, o caminho é ler o CSV em streaming e processar em lotes, com a importação rodando em segundo plano e a tela acompanhando o progresso.
- **Importações simultâneas do mesmo posto:** são seguras no banco (o upsert trava a linha e a segunda espera), mas vale a última a terminar. Uma trava por importação deixaria isso explícito para o usuário.
- **Responsável compartilhado:** uma importação que muda o e-mail de um CPF muda o e-mail desse responsável em todos os postos dele. É coerente com o modelo, mas merece aviso na tela.
- **Busca em base grande:** índice trigram e paginação por cursor em vez de `OFFSET`.
- **Edição e exclusão de postos pela tela:** fora do escopo do desafio.
- **Testes do frontend:** a validação da interface foi manual, no navegador. O próximo passo seria testar com Playwright o fluxo de importar, corrigir e reimportar.
