import { SgccLogo } from "@/components/ui/SgccLogo";

export default function VotarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <header className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <SgccLogo variant="dark" size="sm" symbolOnly />
          <div
            className="leading-tight"
            style={{ color: "rgba(250,247,242,0.75)" }}
          >
            <p className="text-[10px] uppercase tracking-[0.15em] font-medium">
              Votación
            </p>
            <p className="text-[11px]">Proceso de Insolvencia</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
