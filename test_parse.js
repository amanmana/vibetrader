const customText = `1	
TANCO [S]
2429	s	0.175	0.175	-	-	957,166	143,415	0.170	0.175	89,272	0.180	0.165
2	
DNEX [S]
4456	s	0.450	0.415	+0.035	+8.43	501,791	1,683	0.450	0.455	27,569	0.455	0.420
3	
SRIDGE [S]
0129		0.180	0.130	+0.050	+38.46	379,948	18,910	0.175	0.180	7,381	0.185	0.125
4	
VS [S]
6963	s	0.200	0.200	-	-	368,169	265,731	0.195	0.200	82,525	0.205	0.195`;

const tokens = customText.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
const rawStocks = tokens.filter(t => {
  if (t.length < 2) return false;
  if (t.includes('[') || t.includes(']')) return false;
  if (t.includes('.') || t.includes(',')) return false;
  if (/^\d+$/.test(t)) return t.length === 4;
  if (t.startsWith('+') || t.startsWith('-')) return false;
  return true;
});
console.log(rawStocks);
