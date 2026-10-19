CREATE TABLE importacoes (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome_arquivo    varchar(255) NOT NULL,
  status          varchar(30)  NOT NULL,
  header_original jsonb,
  total_linhas    integer      NOT NULL DEFAULT 0 CHECK (total_linhas >= 0),
  inseridos       integer      NOT NULL DEFAULT 0 CHECK (inseridos >= 0),
  atualizados     integer      NOT NULL DEFAULT 0 CHECK (atualizados >= 0),
  rejeitados      integer      NOT NULL DEFAULT 0 CHECK (rejeitados >= 0),
  total_avisos    integer      NOT NULL DEFAULT 0 CHECK (total_avisos >= 0),
  avisos          jsonb        NOT NULL DEFAULT '[]'::jsonb,
  erro_arquivo    jsonb,
  criada_em       timestamptz  NOT NULL DEFAULT now(),
  finalizada_em   timestamptz,
  CONSTRAINT importacoes_status_ck CHECK (status IN (
    'processando', 'concluida', 'concluida_com_pendencias', 'falhou'
  ))
);

CREATE INDEX importacoes_criada_em_idx ON importacoes (criada_em DESC);

-- Guarda cada linha rejeitada exatamente como veio no arquivo,
-- para gerar o arquivo de correção a qualquer momento.
CREATE TABLE importacao_linhas_rejeitadas (
  id                bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  importacao_id     integer NOT NULL REFERENCES importacoes (id) ON DELETE CASCADE,
  linha             integer NOT NULL CHECK (linha >= 2),
  valores_originais jsonb   NOT NULL,
  erros             jsonb   NOT NULL,
  CONSTRAINT importacao_linhas_rejeitadas_linha_uk UNIQUE (importacao_id, linha)
);
