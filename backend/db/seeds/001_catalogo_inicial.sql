-- Catálogo inicial. Idempotente: pode ser executado várias vezes.
-- Combustíveis e bandeiras desconhecidos também são cadastrados automaticamente na importação.

INSERT INTO combustiveis (nome) VALUES
  ('Gasolina Comum'),
  ('Gasolina Aditivada'),
  ('Etanol'),
  ('Diesel S10'),
  ('Diesel Comum'),
  ('GNV'),
  ('Arla 32')
ON CONFLICT DO NOTHING;

INSERT INTO bandeiras (nome) VALUES
  ('Petrobras'),
  ('Ipiranga'),
  ('Shell'),
  ('Raízen'),
  ('Vibra Energia'),
  ('Alesat'),
  ('Total'),
  ('Repsol'),
  ('Bandeirante'),
  ('Branca')
ON CONFLICT DO NOTHING;
