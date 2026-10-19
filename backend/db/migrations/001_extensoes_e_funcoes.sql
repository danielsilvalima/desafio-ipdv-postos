-- unaccent permite comparar nomes sem diferenciar acentos (ex.: "Raízen" = "Raizen").
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() não é IMMUTABLE, o que impede o uso em índices.
-- Este wrapper fixa o dicionário e pode ser usado em índices únicos.
CREATE OR REPLACE FUNCTION normalizar_nome(valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT lower(public.unaccent('public.unaccent'::regdictionary, btrim(regexp_replace(valor, '\s+', ' ', 'g'))));
$$;

CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
