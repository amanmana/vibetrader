const https = require('https');

async function testScreener() {
  const query = {
    offset: 0,
    size: 100,
    sortField: 'regularMarketVolume',
    sortType: 'DESC',
    quoteType: 'EQUITY',
    query: {
      operator: 'AND',
      operands: [
        { operator: 'eq', operands: ['region', 'my'] },
        { operator: 'eq', operands: ['exchange', 'KLS'] }
      ]
    }
  };

  const url = 'https://query2.finance.yahoo.com/v1/finance/screener';
  const req = https.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const quotes = json.finance.result[0].quotes;
        console.log(`Found ${quotes.length} stocks. Top 5:`);
        quotes.slice(0, 5).forEach(q => console.log(q.symbol, q.shortName, q.regularMarketVolume));
      } catch (e) {
        console.error('Error parsing:', e);
        console.log(data);
      }
    });
  });

  req.write(JSON.stringify(query));
  req.end();
}

testScreener();
