import { FlowcaseLogo } from "@/components/ui/FlowcaseLogo";

export default function VotarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <header className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <FlowcaseLogo variant="lockup" size="sm" darkBg />
          <div
            className="hidden sm:block border-l border-white/15 pl-4 leading-tight"
            style={{ color: "rgba(250,247,242,0.7)" }}
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
