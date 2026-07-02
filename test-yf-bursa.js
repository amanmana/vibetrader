const yahooFinance = require('yahoo-finance2').default;

async function test() {
  try {
    const names = ['INARI', 'UEMS', 'GIIB', 'GENETEC'];
    for (const name of names) {
      const search = await yahooFinance.search(name + ' Malaysia');
      const klQuotes = search.quotes.filter(q => q.exchange === 'KLS'); // Kuala Lumpur
      if (klQuotes.length > 0) {
         console.log(`Found ${name} -> ${klQuotes[0].symbol}`);
      } else {
         console.log(`Not found for ${name}`);
      }
    }
  } catch (e) {
    console.error(e);
  }
}
test();
