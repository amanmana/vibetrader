const customText = `1	
TANCO [S]
2429	s	0.175	0.175	-	-	957,166	143,415	0.170	0.175	89,272	0.180	0.165
2	
DNEX [S]
4456	s	0.450	0.415	+0.035	+8.43	501,791	1,683	0.450	0.455	27,569	0.455	0.420`;

const tokens = customText.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);

let rawStocks = tokens.filter(t => /^\d{4}/.test(t));

if (rawStocks.length === 0) {
  rawStocks = tokens.filter(t => {
    if (t.length < 2) return false;
    if (t.includes('[') || t.includes(']')) return false;
    if (t.includes('.') || t.includes(',')) return false;
    if (/^\d+$/.test(t)) return false;
    if (t.startsWith('+') || t.startsWith('-')) return false;
    if (t === 'CALL' || t === 's' || t.toLowerCase() === 'call') return false;
    return true;
  });
}

let stocks = [...new Set(rawStocks)].slice(0, 30);
console.log(stocks);
