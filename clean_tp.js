const fs = require('fs');

function cleanFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');

  // Remove THs
  content = content.replace(/<th[^>]*>TP[34][\s\S]*?<\/th>/g, '');

  // Remove TD for gannTP3/gannTP4 (Simple ones)
  content = content.replace(/<td[^>]*>\{stock\.gannTP[34][\s\S]*?<\/td>/g, '');
  
  // Remove TD for gannTP3/gannTP4 (showSniperDynamic)
  content = content.replace(/<td className="p-4">\s*<div className="flex flex-col">\s*<span className="font-mono text-sm font-medium text-emerald-400">\{stock\.gannTP[34] \|\| stock\.tp[34]\}<\/span>\s*\{showSniperDynamic[\s\S]*?<\/div>\s*<\/td>/g, '');

  // Remove TD for staticTP3/staticTP4 (Custom Master List and Custom Search)
  // This one spans many lines and includes row.staticTP3 or searchedStock.staticTP3
  content = content.replace(/<td className={`p-4`}>\s*<div className="flex flex-col gap-1">\s*<div className="flex items-center gap-1.5">\s*<div className={`w-1\.5 h-1\.5 rounded-full \$\{(searchedStock|row)\.staticTP[34]Color[\s\S]*?<\/div>\s*\{showDynamic[\s\S]*?<\/div>\s*<\/td>/g, '');

  // For US Custom Search which doesn't have showDynamic sometimes, wait, let's just use a more generic TD regex for staticTP3/4
  // It has <div className={`w-1.5 h-1.5 rounded-full ${...staticTP3Color...}`} />
  content = content.replace(/<td className={`p-4`}>\s*<div className="flex flex-col gap-1">\s*<div className="flex items-center gap-1.5">\s*<div className={`w-1\.5 h-1\.5 rounded-full \$\{[^}]*\.staticTP[34]Color[\s\S]*?<\/div>\s*(?:\{showDynamic[\s\S]*?)?<\/div>\s*<\/td>/g, '');

  // For US Custom Search:
  // <td className="p-4">
  //   <div className="flex items-center gap-1.5">
  //     <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP3Color...}`} />
  //     <span className={`font-mono text-sm font-medium ...`}>${row.staticTP3}</span>
  //   </div>
  // </td>
  content = content.replace(/<td className="p-4">\s*<div className="flex items-center gap-1\.5">\s*<div className={`w-1\.5 h-1\.5 rounded-full \$\{[^}]*\.staticTP[34]Color[\s\S]*?<\/div>\s*<\/td>/g, '');


  fs.writeFileSync(filepath, content);
  console.log(`Cleaned ${filepath}`);
}

cleanFile('src/app/bursa/page.tsx');

// For page.tsx (US Market), the user mentioned they want TP1 and TP2 only.
// In page.tsx we have "Target 3 (TP3)" and "Target 4 (TP4)" in the detailed view.
// Let's also remove them.
function cleanUSPage(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');

  // Remove the block for TP3
  content = content.replace(/<div className="flex flex-col items-center p-3 bg-zinc-900\/50 rounded-xl border border-zinc-800\/50">\s*<span className="text-\[10px\] text-zinc-500 font-medium uppercase tracking-wider mb-1">Target 3 \(TP3\)<\/span>\s*<span className="font-mono text-lg font-bold text-emerald-400">\{cSym\}\{result\.levels\.take_profit_3 \? result\.levels\.take_profit_3\.toFixed\(2\) : '0\.00'\}<\/span>\s*<\/div>/g, '');
  
  // Remove the block for TP4
  content = content.replace(/<div className="flex flex-col items-center p-3 bg-zinc-900\/50 rounded-xl border border-zinc-800\/50">\s*<span className="text-\[10px\] text-zinc-500 font-medium uppercase tracking-wider mb-1">Target 4 \(TP4\)<\/span>\s*<span className="font-mono text-lg font-bold text-emerald-400">\{cSym\}\{result\.levels\.take_profit_4 \? result\.levels\.take_profit_4\.toFixed\(2\) : '0\.00'\}<\/span>\s*<\/div>/g, '');

  // Grid cols from grid-cols-5 to grid-cols-3
  content = content.replace(/grid-cols-5 gap-3 mt-6/g, 'grid-cols-3 gap-3 mt-6');

  // Risk bar TP3 and TP4
  content = content.replace(/<div className="bg-cyan-500\/80 h-full w-1\/4" title="TP3 Zone \(TP2 to TP3\)" \/>\s*<div className="bg-blue-600\/80 h-full w-1\/4 rounded-r-full" title="TP4 Zone \(TP3 to TP4\)" \/>/g, '');
  
  // Risk bar text labels
  content = content.replace(/<span className="absolute right-0">TP3 \(\{cSym\}\{result\.levels\.take_profit_3 \? result\.levels\.take_profit_3\.toFixed\(2\) : '0\.00'\}\)<\/span>/g, '');
  content = content.replace(/<span className="absolute right-0">TP4 \(\{cSym\}\{result\.levels\.take_profit_4 \? result\.levels\.take_profit_4\.toFixed\(2\) : '0\.00'\}\)<\/span>/g, '');

  // We should also adjust the width of TP1 and TP2 in the risk bar to be 50% each instead of 1/4?
  content = content.replace(/w-1\/4/g, 'w-1/2'); // This might affect other w-1/4, but wait.
  // Actually, the risk bar has:
  // <div className="bg-emerald-500/80 h-full w-1/4" title="TP1 Zone (Entry to TP1)" />
  // <div className="bg-teal-500/80 h-full w-1/4" title="TP2 Zone (TP1 to TP2)" />
  // Let's do a safer replace:
  content = content.replace(/<div className="bg-emerald-500\/80 h-full w-1\/4"/g, '<div className="bg-emerald-500/80 h-full w-1/2"');
  content = content.replace(/<div className="bg-teal-500\/80 h-full w-1\/4" title="TP2 Zone \(TP1 to TP2\)" \/>/g, '<div className="bg-teal-500/80 h-full w-1/2 rounded-r-full" title="TP2 Zone (TP1 to TP2)" />');

  // Also remove Static Gann TP3 and TP4 from the detailed view:
  content = content.replace(/<div className="flex items-center justify-between p-3 bg-zinc-900\/50 rounded-xl border border-zinc-800\/50">\s*<span className="text-xs text-zinc-400">Gann TP3<\/span>\s*<div className="flex items-center gap-2">\s*<div className=\{`w-2 h-2 rounded-full[^\n]*\/>\s*<span className="font-mono font-bold text-emerald-400">\{cSym\}\{gann\.staticTP3\}<\/span>\s*<\/div>\s*<\/div>/g, '');
  content = content.replace(/<div className="flex items-center justify-between p-3 bg-zinc-900\/50 rounded-xl border border-zinc-800\/50">\s*<span className="text-xs text-zinc-400">Gann TP4<\/span>\s*<div className="flex items-center gap-2">\s*<div className=\{`w-2 h-2 rounded-full[^\n]*\/>\s*<span className="font-mono font-bold text-emerald-400">\{cSym\}\{gann\.staticTP4\}<\/span>\s*<\/div>\s*<\/div>/g, '');


  fs.writeFileSync(filepath, content);
  console.log(`Cleaned ${filepath}`);
}

cleanUSPage('src/app/page.tsx');
