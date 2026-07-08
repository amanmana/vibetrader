const https = require('https');

https.get('https://query2.finance.yahoo.com/v8/finance/chart/0393.KL?range=1mo&interval=1d', {
  headers: { "User-Agent": "Mozilla/5.0" }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const obj = JSON.parse(data).chart.result[0];
      const highs = obj.indicators.quote[0].high;
      const lows = obj.indicators.quote[0].low;
      const closes = obj.indicators.quote[0].close;
      
      const size = closes.length;
      let flatCandles = 0;
      for (let i = Math.max(0, size - 10); i < size; i++) {
        if (highs[i] - lows[i] <= 0.0051) {
          flatCandles++;
        }
      }
      
      console.log(`Flat candles in last 10 days: ${flatCandles}`);
    } catch(e) {
      console.log("Error or data:", data);
    }
  });
});
