#!/bin/bash
# scripts/setup-db.sh
# Ejecuta migraciones y seed en Supabase.
# Uso: bash scripts/setup-db.sh
# Requiere: SUPABASE_DB_URL en .env.local

set -e

echo "=== SGCC — Setup de Base de Datos ==="
echo ""

# Cargar variables de entorno si existe .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

DB_URL="${SUPABASE_DB_URL:-}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL no está definida en .env.local"
  echo "Ejemplo: SUPABASE_DB_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres"
  exit 1
fi

echo "1/4 — Ejecutando migración 001 (tablas base)..."
psql "$DB_URL" -f supabase/migrations/001_base_tables.sql
echo "    ✓ Tablas base creadas"

echo "2/4 — Ejecutando migración 002 (tablas nuevas)..."
psql "$DB_URL" -f supabase/migrations/002_new_tables.sql
echo "    ✓ Tablas nuevas creadas"

echo "3/4 — Ejecutando migración 003 (RLS policies)..."
psql "$DB_URL" -f supabase/migrations/003_rls_policies.sql
echo "    ✓ RLS policies aplicadas"

echo "4/4 — Ejecutando seed data..."
psql "$DB_URL" -f supabase/seed.sql
echo "    ✓ Datos de prueba insertados"

echo ""
echo "=== Setup completado ==="
echo ""
echo "Centro demo: Centro de Conciliación Demo"
echo "Admin:       admin@centrodemo.com / demo1234"
echo "Conciliador: conciliador@centrodemo.com / demo1234"
echo "Secretaria:  secretaria@centrodemo.com / demo1234"
