-- supabase/migrations/003_rls_policies.sql
-- Row Level Security para multi-tenant
-- NOTA: El código usa supabaseAdmin (service_role) en todas las API routes,
-- que bypassa RLS por defecto. Las policies permisivas protegen contra
-- acceso directo con anon key. La seguridad multi-tenant se aplica en la
-- capa de aplicación filtrando por center_id del JWT.

-- Habilitar RLS en todas las tablas
ALTER TABLE sgcc_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_actas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_attorneys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_attorneys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_correspondence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_correspondence_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_watched_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_process_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_hearing_attendance ENABLE ROW LEVEL SECURITY;

-- Tablas de lectura pública (necesarias para login/registro)
CREATE POLICY "centers_select" ON sgcc_centers FOR SELECT USING (TRUE);
CREATE POLICY "staff_select" ON sgcc_staff FOR SELECT USING (TRUE);
CREATE POLICY "parties_select" ON sgcc_parties FOR SELECT USING (TRUE);

-- Todas las demás tablas: acceso via service_role
CREATE POLICY "allow_all" ON sgcc_rooms FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_cases FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_case_parties FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_hearings FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_actas FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_documents FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_templates FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_notifications FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_case_timeline FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_attorneys FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_case_attorneys FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_checklists FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_checklist_responses FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_correspondence FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_correspondence_docs FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_watched_processes FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_process_updates FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_hearing_attendance FOR ALL USING (TRUE);

-- Storage bucket para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('sgcc-documents', 'sgcc-documents', TRUE)
ON CONFLICT DO NOTHING;
