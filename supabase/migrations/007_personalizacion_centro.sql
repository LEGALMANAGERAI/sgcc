-- Campos de personalización visual del centro
ALTER TABLE sgcc_centers ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#0D2340';
ALTER TABLE sgcc_centers ADD COLUMN IF NOT EXISTS color_secundario TEXT DEFAULT '#1B4F9B';

-- Campo para documentos subidos por partes
ALTER TABLE sgcc_documents ADD COLUMN IF NOT EXISTS subido_por_party_id UUID REFERENCES sgcc_parties(id);
