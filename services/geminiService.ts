
import { GoogleGenAI, Type } from "@google/genai";
import { Category } from "../types";

export const analyzeReceipt = async (base64Image: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `You are a high-precision OCR, Translation, and financial analysis agent. 
  TASK:
  1. Carefully scan the provided image, which may contain a HANDWRITTEN or printed receipt.
  2. The text may be in SINHALA (සිංහල) or English. Perform deep OCR to extract all text.
  3. TRANSLATE all extracted Sinhala text (Store Name, Item Names) into ENGLISH.
  4. Extract the Store Name (translated), Date (YYYY-MM-DD format), Time (HH:MM format), and individual line items.
  5. IMPORTANT - CURRENCY: All prices and totals MUST be in Sri Lankan Rupees (Rs.). 
     If the receipt is in another currency (USD, EUR, etc.), CONVERT the values to Rupees using a current approximate exchange rate.
  6. For EACH item, provide its name (translated), price (in Rs.), and categorize it into exactly ONE of these categories: ${Object.values(Category).join(", ")}.
  7. Provide a dominant overall category for the whole receipt.
  
  CRITICAL INSTRUCTION:
  - If the image is unreadable, set 'isReadable' to false.
  - All output text must be in ENGLISH.
  - Return ONLY a valid JSON object.
  - If the currency on the receipt is not LKR, convert it and state values in Rs.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isReadable: { type: Type.BOOLEAN },
            storeName: { type: Type.STRING },
            date: { type: Type.STRING, description: "YYYY-MM-DD format" },
            time: { type: Type.STRING, description: "HH:MM format" },
            total: { type: Type.NUMBER, description: "Total in Rs." },
            category: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                },
                required: ["name", "price", "category"]
              }
            }
          },
          required: ["isReadable"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
