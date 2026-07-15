"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-center gap-4">
        <Link 
          href="/" 
          className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${pathname === '/' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
        >
          US Market
        </Link>
        <Link 
          href="/bursa" 
          className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${pathname === '/bursa' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
        >
          Bursa Malaysia
        </Link>
      </div>
    </div>
  );
}
