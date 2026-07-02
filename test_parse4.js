const customText = `MYEG YTL`;

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
console.log(rawStocks);
