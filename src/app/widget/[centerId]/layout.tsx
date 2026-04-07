import { supabaseAdmin } from "@/lib/supabase";

export default async function WidgetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ centerId: string }>;
}) {
  const { centerId } = await params;

  // Obtener info del centro para mostrar logo
  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("nombre, logo_url")
    .eq("id", centerId)
    .single();

  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, background: "#ffffff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "24px 16px",
            minHeight: "100vh",
            boxSizing: "border-box",
          }}
        >
          {/* Logo del centro */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            {center?.logo_url ? (
              <img
                src={center.logo_url}
                alt={center?.nombre ?? "Centro de Conciliación"}
                style={{ maxHeight: 60, maxWidth: 200, objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0D2340",
                  padding: "8px 0",
                }}
              >
                {center?.nombre ?? "Centro de Conciliación"}
              </div>
            )}
            <div
              style={{
                height: 2,
                background: "linear-gradient(90deg, transparent, #1B4F9B, transparent)",
                marginTop: 12,
              }}
            />
          </div>

          {children}
        </div>
      </body>
    </html>
  );
}
