import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System instruction for the chat assistant
const CHAT_SYSTEM_INSTRUCTION = `
Role: Kamu adalah 'Tenangin', asisten virtual untuk pemilik UMKM kecil di Indonesia.
Tone: Hangat, empatik, suportif, dan menenangkan. Gunakan bahasa Indonesia sehari-hari yang sopan namun akrab (lu/gue atau aku/kamu tergantung user, tapi default ke 'aku/kamu' yang sopan).
Goal: Membantu pemilik usaha merasa didengar, memberikan saran bisnis ringan, dan menenangkan kecemasan mereka. Jangan berikan nasihat finansial yang rumit atau jargon teknis.
Context: User sedang lelah bekerja seharian. Berikan respon pendek tapi bermakna.
`;

// Helper to generate a daily verdict using Gemini Flash Lite (Fast response)
export const getNightlyInsight = async (transactions: Transaction[], shopName: string): Promise<{ verdict: string; empathyMessage: string; status: 'green' | 'yellow' }> => {
  try {
    const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);
    const itemCount = transactions.length;
    
    // Quick summary string for the prompt
    const summary = `Total penjualan hari ini: Rp ${totalRevenue.toLocaleString('id-ID')}. Jumlah transaksi: ${itemCount}. Barang terjual: ${transactions.map(t => t.itemName).join(', ')}.`;

    const prompt = `
    Analisa data penjualan hari ini untuk toko "${shopName}".
    Data: ${summary}
    
    Berikan output JSON saja dengan format:
    {
      "verdict": "Singkat (max 4 kata). Contoh: 'Aman Belanja Besok' atau 'Hemat Dulu Ya'",
      "empathyMessage": "Kalimat penenang (max 15 kata) yang relevan dengan performa hari ini.",
      "status": "green" (jika hasil bagus) atau "yellow" (jika hasil sedang/kurang)
    }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
        verdict: result.verdict || "Istirahat Dulu",
        empathyMessage: result.empathyMessage || "Kamu sudah berusaha keras hari ini.",
        status: result.status === 'green' ? 'green' : 'yellow'
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      verdict: "Istirahatlah",
      empathyMessage: "Apapun hasilnya, kesehatanmu nomor satu. Tidur yang nyenyak.",
      status: "yellow"
    };
  }
};

// General Chat Function using Gemini Pro (Complex reasoning)
export const chatWithGemini = async (history: { role: string; parts: { text: string }[] }[], newMessage: string) => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "Maaf, aku lagi agak pusing nih. Coba lagi nanti ya.";
  }
};

// Smart Parsing using Flash Lite (Fallback if Regex fails or for complex inputs)
export const parseTransactionSmart = async (input: string): Promise<{ itemName: string, price: number, quantity: number } | null> => {
    try {
        const prompt = `
        Parse teks transaksi UMKM ini menjadi JSON: "${input}"
        Format JSON: { "itemName": string, "price": number (total price in IDR integer), "quantity": number }
        Jika harga dalam ribuan (misal 32rb), konversi ke 32000.
        Jika tidak valid, return null.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return JSON.parse(response.text || 'null');
    } catch (e) {
        return null;
    }
                                                     }
