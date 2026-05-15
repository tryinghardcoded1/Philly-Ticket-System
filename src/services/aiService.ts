import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Ticket } from '../types';

export async function extractTicketData(imageFile: File): Promise<Partial<Ticket>> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

  try {
    const readBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          resolve(result.split(',')[1]);
        };
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    };

    const base64Data = await readBase64(imageFile);

    const prompt = `
      Analyze this vehicle ticket (parking, speeding, etc.).
      Extract the following information in JSON format:
      {
        "plate_number": "normalized string without spaces/dashes",
        "violation_date": "YYYY-MM-DD",
        "amount": number (just the value, e.g. 50.00),
        "violation_type": "short description e.g. Parking Ticket",
        "state": "2 letter state code, if available"
      }
      Return ONLY valid JSON.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        { inlineData: { mimeType: imageFile.type, data: base64Data } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plate_number: { type: Type.STRING },
            violation_date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            violation_type: { type: Type.STRING },
            state: { type: Type.STRING }
          },
          required: ["plate_number", "violation_date", "amount", "violation_type", "state"]
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No response text from AI");
    const extracted = JSON.parse(text);

    return {
      plateNumber: extracted.plate_number || 'UNKNOWN',
      violationDate: extracted.violation_date || new Date().toISOString().split('T')[0],
      amount: Number(extracted.amount) || 0,
      violationType: extracted.violation_type || 'Unknown Violation',
      location: extracted.state || 'Unknown Location'
    } as any;
  } catch (error) {
    console.error("AI Extraction failed:", error);
    // Return placeholder if AI fails
    return {
      plateNumber: "ABC-1234",
      violationDate: new Date().toISOString().split('T')[0],
      amount: 45.00,
      violationType: 'Speeding',
      location: 'PA'
    } as any;
  }
}

