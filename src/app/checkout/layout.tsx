import Link from "next/link";

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <header className="bg-white border-b border-[#DDE4ED]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-black text-[#0D2340]">
            SI<span className="text-[#B8860B]">GECC</span>
          </Link>
          <Link
            href="/precios"
            className="text-sm text-[#7A8FA6] hover:text-[#0D2340] transition-colors"
          >
            ← Volver a precios
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
