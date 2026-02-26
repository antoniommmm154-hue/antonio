import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TranscriptionResult {
  text: string;
  summary: string;
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  targetLanguage: 'pt' | 'en',
  shouldTranslate: boolean
): Promise<TranscriptionResult> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are an expert transcription and translation assistant. 
  Your goal is to capture speech with maximum detail, correct all grammatical and spelling errors, and provide a concise summary.
  Always return the response in JSON format with 'text' (the full corrected transcription) and 'summary' (a brief overview of the content).`;

  const prompt = shouldTranslate 
    ? `Transcribe the following audio and TRANSLATE it to ${targetLanguage === 'pt' ? 'Portuguese' : 'English'}. 
       Correct all spelling and grammar errors. Capture every detail. 
       Return JSON with 'text' (translated & corrected) and 'summary' (in ${targetLanguage === 'pt' ? 'Portuguese' : 'English'}).`
    : `Transcribe the following audio in its ORIGINAL language. 
       DO NOT translate. Correct all spelling and grammar errors in that original language. 
       Capture every detail. 
       Return JSON with 'text' (corrected original) and 'summary' (in ${targetLanguage === 'pt' ? 'Portuguese' : 'English'}).`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The full corrected transcription text." },
          summary: { type: Type.STRING, description: "A brief summary of the transcription." },
        },
        required: ["text", "summary"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}") as TranscriptionResult;
  } catch (e) {
    console.error("Failed to parse transcription response", e);
    return { text: response.text || "", summary: "" };
  }
}

export async function textToSpeech(text: string, language: 'pt' | 'en') {
  const model = "gemini-2.5-flash-preview-tts";
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: `Say this clearly in ${language === 'pt' ? 'Portuguese' : 'English'}: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
}
