-- supabase/migrations/015_codigo_corto_centro.sql
-- Agregar código corto legible a sgcc_centers para compartir por WhatsApp/teléfono

-- Columna codigo_corto: 8 caracteres alfanuméricos uppercase, único
ALTER TABLE sgcc_centers
  ADD COLUMN IF NOT EXISTS codigo_corto TEXT UNIQUE;

-- Función para generar código corto aleatorio
CREATE OR REPLACE FUNCTION generate_codigo_corto()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin I,O,0,1 para evitar confusión
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Generar código corto para centros existentes que no tengan uno
DO $$
DECLARE
  centro RECORD;
  nuevo_codigo TEXT;
  intentos INTEGER;
BEGIN
  FOR centro IN SELECT id FROM sgcc_centers WHERE codigo_corto IS NULL LOOP
    intentos := 0;
    LOOP
      nuevo_codigo := generate_codigo_corto();
      -- Verificar unicidad
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM sgcc_centers WHERE codigo_corto = nuevo_codigo
      );
      intentos := intentos + 1;
      IF intentos > 100 THEN
        RAISE EXCEPTION 'No se pudo generar código único para centro %', centro.id;
      END IF;
    END LOOP;

    UPDATE sgcc_centers SET codigo_corto = nuevo_codigo WHERE id = centro.id;
  END LOOP;
END;
$$;

-- Ahora que todos tienen código, hacer NOT NULL
ALTER TABLE sgcc_centers
  ALTER COLUMN codigo_corto SET NOT NULL;

-- Trigger para auto-generar en nuevos centros
CREATE OR REPLACE FUNCTION set_codigo_corto()
RETURNS TRIGGER AS $$
DECLARE
  nuevo_codigo TEXT;
  intentos INTEGER := 0;
BEGIN
  IF NEW.codigo_corto IS NULL OR NEW.codigo_corto = '' THEN
    LOOP
      nuevo_codigo := generate_codigo_corto();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM sgcc_centers WHERE codigo_corto = nuevo_codigo
      );
      intentos := intentos + 1;
      IF intentos > 100 THEN
        RAISE EXCEPTION 'No se pudo generar código corto único';
      END IF;
    END LOOP;
    NEW.codigo_corto := nuevo_codigo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_codigo_corto
  BEFORE INSERT ON sgcc_centers
  FOR EACH ROW
  EXECUTE FUNCTION set_codigo_corto();
