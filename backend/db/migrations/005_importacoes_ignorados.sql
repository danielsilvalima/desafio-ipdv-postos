-- "ignorados": linhas válidas descartadas porque o mesmo CNPJ reaparece mais abaixo no arquivo.
-- "novos_cadastros": bandeiras e combustíveis criados automaticamente por esta importação.
ALTER TABLE importacoes
  ADD COLUMN ignorados       integer NOT NULL DEFAULT 0 CHECK (ignorados >= 0),
  ADD COLUMN novos_cadastros jsonb   NOT NULL DEFAULT '{"bandeiras": [], "combustiveis": []}'::jsonb;
