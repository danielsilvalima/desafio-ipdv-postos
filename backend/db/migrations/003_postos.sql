CREATE TABLE postos (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cnpj             char(14)     NOT NULL,
  razao_social     varchar(200) NOT NULL CHECK (btrim(razao_social) <> ''),
  nome_fantasia    varchar(200),
  bandeira_id      integer      NOT NULL REFERENCES bandeiras (id) ON DELETE RESTRICT,
  responsavel_id   integer      NOT NULL REFERENCES responsaveis (id) ON DELETE RESTRICT,
  logradouro       varchar(200) NOT NULL CHECK (btrim(logradouro) <> ''),
  numero           varchar(20),
  complemento      varchar(100),
  bairro           varchar(100) NOT NULL CHECK (btrim(bairro) <> ''),
  municipio        varchar(100) NOT NULL CHECK (btrim(municipio) <> ''),
  uf               char(2)      NOT NULL,
  cep              char(8)      NOT NULL,
  status           varchar(20)  NOT NULL,
  data_inauguracao date,
  numero_bicos     integer,
  numero_pistas    integer,
  observacoes      text,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT postos_cnpj_uk UNIQUE (cnpj),
  CONSTRAINT postos_cnpj_formato_ck CHECK (cnpj ~ '^[0-9]{14}$'),
  CONSTRAINT postos_cep_formato_ck CHECK (cep ~ '^[0-9]{8}$'),
  CONSTRAINT postos_uf_ck CHECK (uf IN (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  )),
  CONSTRAINT postos_status_ck CHECK (status IN ('ativo', 'inativo', 'em_implantacao')),
  CONSTRAINT postos_numero_bicos_ck CHECK (numero_bicos >= 0),
  CONSTRAINT postos_numero_pistas_ck CHECK (numero_pistas >= 0)
);

CREATE INDEX postos_bandeira_id_idx ON postos (bandeira_id);
CREATE INDEX postos_responsavel_id_idx ON postos (responsavel_id);

CREATE TRIGGER postos_updated_at
  BEFORE UPDATE ON postos
  FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

-- "ordem" preserva a sequência em que os combustíveis vieram no CSV,
-- para que a exportação devolva a lista na mesma ordem.
CREATE TABLE posto_combustiveis (
  posto_id       integer  NOT NULL REFERENCES postos (id) ON DELETE CASCADE,
  combustivel_id integer  NOT NULL REFERENCES combustiveis (id) ON DELETE RESTRICT,
  ordem          smallint NOT NULL CHECK (ordem >= 1),
  PRIMARY KEY (posto_id, combustivel_id)
);

CREATE INDEX posto_combustiveis_combustivel_id_idx ON posto_combustiveis (combustivel_id);
