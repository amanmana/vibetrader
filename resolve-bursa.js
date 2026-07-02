const names = [
  'ZETRIX', 'GIIB', 'INARI', 'SFPTECH', 'GENETEC', 'UEMS', 'SUM', 'OPPSTAR', 'EIPOWER', 'NE', 'MCLEAN', 'ICENTS', 
  'CPETECH', 'OGX', 'SPSETIA', 'EG', 'CBHB', 'TTVHB', 'YBS', 'CTOS', 'PEKAT', 'SAMAIDEN', 'CNERGEN', 'IAB', 'MTTSL', 
  'AMBEST', 'GDGROUP', 'MITRA', 'MYEG', 'DAYANG', 'ARMADA', 'DSONIC', 'DIALOG', 'GTRONIC', 'FRONTKN', 'PBBANK', 
  'MAYBANK', 'CIMB', 'TENAGA', 'IHH', 'AXIATA', 'MAXIS', 'AMBANK', 'NESTLE', 'MRDIY', 'SIMEPROP', 'GAMUDA', 'SUNWAY',
  'YTL', 'YTLPOWR', 'MAHB', 'WCEHB', 'EKOVEST', 'IJM', 'UZAIMA', 'KOSSAN', 'HARTA', 'TOPGLOV', 'SUPERMX', 'CAREPLS',
  'DNEX', 'JCY', 'MI', 'MPI', 'UNISEM', 'GREATEC', 'PENTA', 'UWC', 'GHL', 'REVENUE', 'RGB', 'MUIIND', 'BJCORP', 
  'AAX', 'CAPITALA', 'ECOWLD', 'MAHSING', 'MATRIX', 'IOIPG', 'OSK', 'KPJ', 'TM', 'TIMECOM', 'BIMB', 'HLBANK', 
  'RHBBANK', 'PETDAG', 'PETGAS', 'KLK', 'SIME', 'SDG', 'ASTRO', 'MEDIA', 'STAR'
];

const https = require('https');

async function resolve(name) {
  return new Promise(res => {
    https.get(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(name)}&quotesCount=5`, (response) => {
      let data = '';
      response.on('data', c => data += c);
      response.on('end', () => {
        try {
          const quotes = JSON.parse(data).quotes || [];
          const klse = quotes.find(q => q.exchange === 'KLS' || q.symbol.endsWith('.KL'));
          if (klse) res({ name, symbol: klse.symbol, companyName: klse.shortname || klse.longname || name });
          else res(null);
        } catch (e) { res(null); }
      });
    }).on('error', () => res(null));
  });
}

async function run() {
  const result = [];
  for (let i = 0; i < names.length; i += 10) {
    const chunk = names.slice(i, i + 10);
    const resolved = await Promise.all(chunk.map(resolve));
    result.push(...resolved.filter(r => r !== null));
    console.log(`Processed ${i + 10}/${names.length}`);
  }
  const fs = require('fs');
  fs.writeFileSync('bursa-master-list.json', JSON.stringify(result, null, 2));
  console.log('Saved to bursa-master-list.json');
}

run();
