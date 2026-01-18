
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";
import { decode, decodeAudioData, concatenateAudioBuffers } from "../utils/audioHelper";
import { SAMPLE_RATE } from "../constants";

const MAX_CHARS_PER_CHUNK = 1000;

export async function generateSpeech(
  text: string,
  voiceName: VoiceName,
  audioContext: AudioContext,
  onProgress?: (current: number, total: number) => void
): Promise<AudioBuffer> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Clean text and split into logical chunks
  const cleanedText = text.replace(/\n{3,}/g, '\n\n').trim();
  const chunks = splitText(cleanedText, MAX_CHARS_PER_CHUNK);
  const audioBuffers: AudioBuffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    
    const chunkText = chunks[i];
    if (!chunkText || chunkText.length < 1) continue;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: chunkText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      
      if (!base64Audio) {
        console.warn(`Chunk ${i+1} returned no audio. Content: "${chunkText.substring(0, 20)}..."`);
        continue;
      }

      const rawBytes = decode(base64Audio);
      const buffer = await decodeAudioData(rawBytes, audioContext, SAMPLE_RATE, 1);
      audioBuffers.push(buffer);
      
      // Small cooling delay to prevent rate limits on very large texts
      if (chunks.length > 5) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.error(`Error processing chunk ${i + 1}:`, err);
      throw new Error(`Ошибка на фрагменте ${i + 1}: ${err instanceof Error ? err.message : 'Неизвестная ошибка API'}`);
    }
  }

  if (audioBuffers.length === 0) {
    throw new Error("Не удалось сгенерировать ни одного аудио-фрагмента.");
  }

  return concatenateAudioBuffers(audioBuffers, audioContext, 0.4); // 400ms pause between chunks
}

/**
 * Splits text into manageable chunks respecting paragraph and sentence boundaries.
 */
function splitText(text: string, limit: number): string[] {
  const chunks: string[] = [];
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const para of paragraphs) {
    if (para.length > limit) {
      // If a single paragraph is too long, split it by sentences
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      const sentences = para.match(/[^.!?\n]+[.!?\n]*/g) || [para];
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > limit && currentChunk !== '') {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
    } else if ((currentChunk + para).length > limit && currentChunk !== '') {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 0);
}
