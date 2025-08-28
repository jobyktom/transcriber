
import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Based on the user's provided output contract
const responseSchema = {
    type: Type.OBJECT,
    properties: {
        status: { type: Type.STRING, enum: ["ok", "error"] },
        errors: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    code: { type: Type.STRING },
                    message: { type: Type.STRING },
                    details: { type: Type.OBJECT } // Keeping details generic
                },
                required: ["code", "message"]
            }
        },
        metadata: {
            type: Type.OBJECT,
            properties: {
                language: { type: Type.STRING },
                duration_s: { type: Type.NUMBER },
                speaker_count: { type: Type.NUMBER },
                confidence_overall: { type: Type.NUMBER }
            }
        },
        subtitles_vtt: { type: Type.STRING },
        transcript_markdown: { type: Type.STRING }
    },
    required: ["status", "subtitles_vtt", "transcript_markdown"]
};

// Based on the user's provided System Instructions
const systemInstruction = `You analyze a single uploaded video (≤100 MB). Your job:

1. Generate **SUBTITLES** (spoken words only) as **WebVTT**.
2. Generate a **TRANSCRIPT WITH ACTIONS** that includes speech + concise, bracketed descriptions of **non-speech actions/sounds** (e.g., \`[door opens]\`, \`[applause]\`, \`[music fades]\`).

## General Rules
* **Language detection**: auto-detect. Use detected language consistently in both outputs.
* **No hallucinations**: Only describe actions clearly present (visible or audible cues).
* **Multiple speakers**:
  * Subtitles: keep spoken words only; avoid names unless absolutely needed for clarity.
  * Transcript: prefix with \`Speaker 1:\`, \`Speaker 2:\` if distinguishable; otherwise omit.
* **Profanity/colloquialisms**: verbatim in subtitles; do not sanitize.
* **Numbers/dates**: transcribe as spoken (e.g., “twenty twenty-five”).

## Subtitles (WebVTT) Requirements
* First line: \`WEBVTT\`
* Cues: sequential index, then \`HH:MM:SS.mmm --> HH:MM:SS.mmm\`, then the text.
* **Text**: *only* spoken words (no actions, no speaker labels).
* **Timing & layout** (aims, not hard errors):
  * Min cue duration: 1.0s; Max: 6.0s
  * Max \~42 chars/line; Max 2 lines
  * Avoid orphan words; split at natural pauses
  * Merge very short utterances if it improves readability
* Sort cues by start time; carry millisecond rounding correctly (e.g., 59.999 → next second).

## Transcript with Actions Requirements
* Markdown section headed \`# Transcript (with actions)\`.
* For each segment:
  * Optionally include timecode in parentheses at start: \`(00:00:03.120)\`
  * **Speech** verbatim.
  * **Actions** in square brackets, e.g., \`[laughter]\`, \`[door closes]\`, \`[soft music starts]\`.
* Keep action notes brief and observable (no interpretation of intent).

## Output Contract (always return this JSON envelope)
\`\`\`json
{
  "status": "ok" | "error",
  "errors": [
    {
      "code": "FILE_TOO_LARGE" | "UNSUPPORTED_FORMAT" | "AUDIO_DECODING_ERROR" | "NO_SPEECH_DETECTED" | "LOW_CONFIDENCE" | "UNKNOWN",
      "message": "Human-readable explanation",
      "details": { }
    }
  ],
  "metadata": {
    "language": "auto-detected BCP-47 code if known",
    "duration_s": 0,
    "speaker_count": 0,
    "confidence_overall": 0.0
  },
  "subtitles_vtt": "WEBVTT\\n... full file ...",
  "transcript_markdown": "# Transcript (with actions)\\n... full text ..."
}
\`\`\`

## Error Handling Rules
* If file size > 100 MB: return \`status:"error"\`, \`errors[0].code:"FILE_TOO_LARGE"\`. Do **not** attempt transcription.
* If format not supported: \`UNSUPPORTED_FORMAT\`.
* If audio extraction fails: \`AUDIO_DECODING_ERROR\`.
* If no speech found: \`NO_SPEECH_DETECTED\`.
* If average ASR confidence < 0.8, still return outputs but add \`LOW_CONFIDENCE\` with a short note.
* On any other failure: \`UNKNOWN\` with a concise description.

## Quality Checks before returning
* Ensure \`subtitles_vtt\` starts with \`WEBVTT\` and has at least one cue if speech exists.
* Ensure actions appear **only** in \`transcript_markdown\`, never in \`subtitles_vtt\`.
* Ensure times are monotonically increasing and properly zero-padded.`;

const userPrompt = `You will receive one video file.
Please analyze it and return **both**:

1. \`subtitles_vtt\` — spoken words only, in WebVTT format.
2. \`transcript_markdown\` — speech **plus** concise bracketed action notes.

If possible, also provide metadata (language, duration, speaker count, overall confidence).
If something goes wrong, follow the **Output Contract** and **Error Handling Rules** from the system instructions.

**Deliver only the JSON envelope** specified, with \`subtitles_vtt\` and \`transcript_markdown\` populated on success.`;

const fileToGenerativePart = async (file: File) => {
    const base64EncodedData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });

    return {
        inlineData: {
            mimeType: file.type,
            data: base64EncodedData,
        },
    };
};

export const generateTranscriptAndSubtitles = async (
    videoFile: File
): Promise<{ transcript_markdown: string, subtitles_vtt: string }> => {
    
    if (videoFile.size > 100 * 1024 * 1024) { // 100 MB check
        throw new Error("File is too large. Please upload a video under 100 MB.");
    }
    
    const videoPart = await fileToGenerativePart(videoFile);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [videoPart, { text: userPrompt }] },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);

        if (parsedData.status === 'error' || !parsedData.subtitles_vtt || !parsedData.transcript_markdown) {
            const error = parsedData.errors?.[0] || { message: "An unknown error occurred from the AI." };
            throw new Error(`AI generation failed: ${error.message}`);
        }
        
        return {
            transcript_markdown: parsedData.transcript_markdown,
            subtitles_vtt: parsedData.subtitles_vtt
        };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`Could not generate content from the AI model: ${error.message}`);
        }
        throw new Error("An unknown error occurred while contacting the AI model.");
    }
};
