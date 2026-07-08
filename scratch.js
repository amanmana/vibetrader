const finvizText = `
1	NVDA	NVIDIA Corporation	Technology	Semiconductors	USA	3230.12B	46.47	130.31	1.19%	21,114,357
2	AAPL	Apple Inc.	Technology	Consumer Electronics	USA	2800.00M	30.00	15.00	1.00%	100,000,000
3	XYZ	XYZ Corp	Technology	Software	USA	5.00B	-	19.50	0.50%	1,000,000
`;

const lines = finvizText.trim().split('\n');
const extracted = [];

for (const line of lines) {
  const tickerMatch = line.match(/^\s*\d+\s+([A-Z]{1,5})\b/);
  if (tickerMatch) {
    const ticker = tickerMatch[1];
    
    // Extract Market Cap: looks for a number followed by B or M, usually surrounded by spaces or tabs
    let marketCapInB = 0;
    const mcMatch = line.match(/\b(\d+(?:\.\d+)?)([BM])\b/);
    if (mcMatch) {
      const val = parseFloat(mcMatch[1]);
      const unit = mcMatch[2];
      marketCapInB = unit === 'B' ? val : val / 1000;
    }
    
    // Extract Price: usually the number before the percentage change
    let price = 0;
    const priceMatch = line.match(/\b(\d+(?:\.\d+)?)\s+-?\d+(?:\.\d+)?%/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }
    
    console.log(`Ticker: ${ticker}, MC(B): ${marketCapInB}, Price: ${price}`);
  }
}
