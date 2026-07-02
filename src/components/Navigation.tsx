"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-center gap-4">
        <Link 
          href="/" 
          className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${pathname === '/' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
        >
          US Market
        </Link>
        <Link 
          href="/bursa" 
          className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${pathname === '/bursa' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
        >
          Bursa Malaysia
        </Link>
      </div>
    </div>
  );
}
