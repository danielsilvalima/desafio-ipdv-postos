CREATE TABLE bandeiras (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       varchar(100) NOT NULL CHECK (btrim(nome) <> ''),
  created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bandeiras_nome_normalizado_uk ON bandeiras (normalizar_nome(nome));

CREATE TABLE combustiveis (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       varchar(60) NOT NULL CHECK (btrim(nome) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX combustiveis_nome_normalizado_uk ON combustiveis (normalizar_nome(nome));

CREATE TABLE responsaveis (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cpf        char(11)     NOT NULL,
  nome       varchar(150) NOT NULL CHECK (btrim(nome) <> ''),
  email      varchar(254),
  cargo      varchar(100),
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT responsaveis_cpf_uk UNIQUE (cpf),
  CONSTRAINT responsaveis_cpf_formato_ck CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE TRIGGER responsaveis_updated_at
  BEFORE UPDATE ON responsaveis
  FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
