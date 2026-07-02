import { NextResponse } from 'next/server';

export const runtime = 'edge';

// We need to type the Cloudflare env properly
interface CloudflareEnv {
  AI: any;
}

export async function POST(req: Request) {
  try {
    const { ticker } = await req.json();

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker symbol is required' }, { status: 400 });
    }

    // 1. Fetch News from Yahoo Finance
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch news from Yahoo Finance for ${ticker}`);
    }

    const data = await response.json();
    
    if (!data.news || data.news.length === 0) {
      return NextResponse.json({ 
        sentiment: 'Neutral', 
        summary: `No recent news articles found for ${ticker}.`,
        articles: []
      });
    }

    // 2. Format the news into a prompt
    const articles = data.news.slice(0, 5).map((n: any) => ({
      title: n.title,
      link: n.link,
      publisher: n.publisher
    }));

    const newsText = articles.map((n: any, i: number) => `[${i+1}] Title: ${n.title} (Source: ${n.publisher})`).join('\n');

    const prompt = `
You are an expert financial market analyst. Read the following recent news headlines for the stock ticker ${ticker}:

${newsText}

Based ONLY on these headlines, determine the short-term market sentiment for ${ticker}. 
Return a JSON object strictly matching this format (no markdown, no extra text):
{
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "summary": "A 2 to 3 sentence professional summary explaining the sentiment."
}`;

    // 3. Call Cloudflare Workers AI
    let env: CloudflareEnv;
    try {
      const { getRequestContext } = await import('@cloudflare/next-on-pages');
      env = getRequestContext().env as unknown as CloudflareEnv;
    } catch (e) {
      return NextResponse.json({ error: 'Failed to load Cloudflare Edge Context' }, { status: 500 });
    }

    if (!env || !env.AI) {
      return NextResponse.json({ error: 'Cloudflare AI binding not found. Please ensure [ai] is configured in wrangler.toml' }, { status: 500 });
    }

    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
      messages: [
        { role: 'system', content: 'You are a strict financial JSON API. Only output valid JSON without any markdown formatting.' },
        { role: 'user', content: prompt }
      ]
    });

    let aiOutput = aiResponse.response || aiResponse;
    
    if (typeof aiOutput !== 'string') {
      aiOutput = JSON.stringify(aiOutput);
    }
    
    // Clean up potential markdown formatting from LLM response
    aiOutput = aiOutput.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(aiOutput);
      
      // If it parsed into an object with a response property (Cloudflare nested format)
      if (parsedResult && parsedResult.response && typeof parsedResult.response === 'string') {
        try {
          parsedResult = JSON.parse(parsedResult.response);
        } catch (e) {
          // If the nested response wasn't JSON, just leave parsedResult as is
        }
      } else if (typeof parsedResult === 'string') {
        try {
          parsedResult = JSON.parse(parsedResult);
        } catch (e) {}
      }
    } catch (parseError) {
      console.error('Failed to parse AI output:', aiOutput);
      return NextResponse.json({ error: 'Failed to parse sentiment AI response: ' + aiOutput.substring(0, 50) }, { status: 500 });
    }

    // 4. Return result
    return NextResponse.json({
      sentiment: parsedResult.sentiment || 'Neutral',
      summary: parsedResult.summary || 'Sentiment could not be summarized.',
      articles: articles
    });

  } catch (error: any) {
    console.error('News Sentiment Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
