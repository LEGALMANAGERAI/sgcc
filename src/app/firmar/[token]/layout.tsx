import { Scale } from "lucide-react";

export default function FirmarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-[700px] mx-auto px-4 flex items-center justify-center gap-3">
          <Scale className="w-6 h-6 text-[#B8860B]" />
          <div className="text-center">
            <p className="text-[#0D2340] font-bold text-lg leading-tight">SGCC</p>
            <p className="text-gray-500 text-xs">Firma Electr&#243;nica</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[700px] mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
