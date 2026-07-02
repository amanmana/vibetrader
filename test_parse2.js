const customText = `1	
TANCO [S]
2429	s	0.175	0.175	-	-	957,166	143,415	0.170	0.175	89,272	0.180	0.165
2	
DNEX [S]
4456WE	s	0.450	0.415	+0.035	+8.43	501,791	1,683	0.450	0.455	27,569	0.455	0.420
12	
YTL-C2U
46772U	CALL	0.110	0.105	+0.005	+4.76	235,232	34,000	0.110	0.115	5,090	0.110	0.090
Just Name
MYEG YTL`;

const tokens = customText.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);

// First try to find any tokens that look like Bursa codes (4 digits at the start)
let rawStocks = tokens.filter(t => /^\d{4}/.test(t));

// If no codes found, fallback to parsing names
if (rawStocks.length === 0) {
  rawStocks = tokens.filter(t => {
    if (t.length < 2) return false;
    if (t.includes('[') || t.includes(']')) return false;
    if (t.includes('.') || t.includes(',')) return false;
    if (/^\d+$/.test(t)) return false;
    if (t.startsWith('+') || t.startsWith('-')) return false;
    return true;
  });
}

console.log(rawStocks);
