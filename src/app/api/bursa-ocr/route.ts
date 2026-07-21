import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured in environment variables.' }, { status: 500 });
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);

    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const mimeType = file.type;

    let result;

    const prompt = `
      You are an expert OCR and data extraction system.
      I have uploaded an image of a stock watchlist table from Bursa Malaysia.
      Please extract all the rows from this table and output the result as a valid JSON array.
      
      The table has the following columns:
      - Stock Name (might have a suffix like [S])
      - Last Done
      - Target
      - Highest Price
      - TP2 (might be empty)

      CRITICAL: You must also detect the background color of each row to determine its status.
      - If the row background is Green, set "status" to "Hit TP"
      - If the row background is Yellow, set "status" to "On Going"
      - If the row background is White or has no color, set "status" to "Belum Gerak"

      Respond ONLY with a valid JSON array containing objects with these exact keys:
      "stock_name", "last_done", "target", "highest_price", "tp2", "status".

      Ensure numbers are represented as strings to preserve formatting (e.g. "0.770").
      If a cell is blank, return an empty string "".
      Do not include markdown formatting like \`\`\`json, just output the raw JSON array.
    `;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType
        }
      }
    ];

    try {
      // Stage 1: Try the latest gemini-3.5-flash
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      result = await model.generateContent([prompt, ...imageParts]);
    } catch (err: any) {
      console.warn('Gemini 3.5 Flash failed, attempting Stage 2 fallback (Gemini 3.1 Flash)...', err.message || err);
      
      try {
        // Stage 2: Try the highly stable gemini-3.1-flash
        const model31 = genAI.getGenerativeModel({ model: 'gemini-3.1-flash' });
        result = await model31.generateContent([prompt, ...imageParts]);
      } catch (err31: any) {
        console.warn('Gemini 3.1 Flash failed, querying available models list...', err31.message || err31);
        
        // Stage 3: Dynamic fallback using Google's available models list
        try {
          const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          const modelsData = await modelsRes.json();
          
          const availableModels = modelsData.models
            ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''))
            .filter((name: string) => !name.includes('1.5') && !name.includes('2.0') && !name.includes('2.5')) || [];
            
          if (availableModels.length === 0) {
            throw new Error('No supported Gemini models found for this API key.');
          }
          
          // Select the best available model, preferring flash models
          const fallbackModelName = availableModels.find((m: string) => m.includes('3.5-flash')) ||
                                    availableModels.find((m: string) => m.includes('3.1-flash')) ||
                                    availableModels.find((m: string) => m.includes('flash')) || 
                                    availableModels.find((m: string) => m.includes('pro')) || 
                                    availableModels[0];
                                    
          console.log(`Using dynamically resolved fallback model: ${fallbackModelName}`);
          const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
          result = await fallbackModel.generateContent([prompt, ...imageParts]);
        } catch (dynamicErr: any) {
          // If everything fails, throw a clear consolidated error
          throw new Error(`All Gemini models (3.5-flash, 3.1-flash, and dynamic fallbacks) failed. Last error: ${dynamicErr.message || dynamicErr}`);
        }
      }
    }
    
    const responseText = result.response.text();
    
    // Clean up potential markdown formatting if the model still outputs it
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/```/g, '').trim();
    }

    const parsedData = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error('OCR Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process image' }, { status: 500 });
  }
}
