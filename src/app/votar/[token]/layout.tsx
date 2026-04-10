import { SgccLogo } from "@/components/ui/SgccLogo";

export default function VotarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0D2340] text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <SgccLogo size="sm" showText={false} darkBg />
          <div>
            <p className="text-white font-bold text-lg leading-tight">SGCC</p>
            <p className="text-gray-400 text-xs">Votación — Proceso de Insolvencia</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
