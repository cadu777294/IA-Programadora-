import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getGeminiResponse = async (
  prompt: string, 
  image?: { data: string; mimeType: string },
  audio?: { data: string; mimeType: string },
  onChunk?: (chunk: string) => void,
  systemInstruction?: string
) => {
  try {
    const parts: any[] = [];
    
    if (image) {
      parts.push({
        inlineData: {
          data: image.data,
          mimeType: image.mimeType,
        },
      });
    }

    if (audio) {
      parts.push({
        inlineData: {
          data: audio.data,
          mimeType: audio.mimeType,
        },
      });
    }

    parts.push({ text: prompt || (audio ? "Analise este áudio e responda conforme as instruções." : "") });

    if (onChunk) {
      const response = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: systemInstruction || "Você é um especialista supremo em programação e cibersegurança. Você possui domínio absoluto sobre TODAS as linguagens de programação e script do mundo. Além disso, você é um expert em segurança mobile (Android/iOS), proteção de dados em dispositivos móveis, anonimato digital, proteção de IP, uso de VPNs, Proxy e técnicas de anti-tracking. Você ajuda o usuário com códigos complexos, automação de scripts, análise de vulnerabilidades e arquitetura de sistemas seguros. Suas respostas são técnicas, precisas e sempre focadas em alta performance e privacidade.",
        },
      });

      let fullText = "";
      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          onChunk(fullText);
        }
      }
      return fullText;
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: systemInstruction || "Você é um especialista supremo em programação e cibersegurança. Você possui domínio absoluto sobre TODAS as linguagens de programação e script do mundo. Além disso, você é um expert em segurança mobile (Android/iOS), proteção de dados em dispositivos móveis, anonimato digital, proteção de IP, uso de VPNs, Proxy e técnicas de anti-tracking. Você ajuda o usuário com códigos complexos, automação de scripts, análise de vulnerabilidades e arquitetura de sistemas seguros. Suas respostas são técnicas, precisas e sempre focadas em alta performance e privacidade.",
        },
      });
      return response.text;
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Desculpe, ocorreu um erro ao processar sua solicitação.";
  }
};
