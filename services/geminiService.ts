
import { GoogleGenAI, Type, FileState } from "@google/genai";
import type { GenerationResult, TranslationResult } from "../types";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- TRANSCRIPTION & SUBTITLE GENERATION ---

const generationResponseSchema = {
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
                    details: { type: Type.OBJECT }
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
                confidence_overall: { type: Type.NUMBER },
                profanity_mode: { type: Type.STRING, enum: ["verbatim", "mask", "beep"] },
                masked_terms_count: { type: Type.NUMBER },
                beeped_terms_count: { type: Type.NUMBER }
            },
             required: ["profanity_mode", "masked_terms_count", "beeped_terms_count"]
        },
        subtitles_vtt: { type: Type.STRING },
        transcript_markdown: { type: Type.STRING }
    },
    required: ["status", "metadata", "subtitles_vtt", "transcript_markdown"]
};

const generationSystemInstruction = `You analyze a single uploaded video (≤500 MB). Your job:

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

## Profanity/Abuse Policy (configurable)
Add a runtime parameter:
\`\`\`
safety.profanity_mode = "verbatim" | "mask" | "beep"
\`\`\`
**Behavior**
* Detection: Identify hate speech, racial/ethnic slurs, severe harassment/abuse terms based on context. Do **not** censor neutral words or quoted homographs.
* Subtitles (VTT):
  * \`"verbatim"\` → leave as-is.
  * \`"mask"\` → mask inner letters, preserve word length & first/last characters. Example: \`f***\`, \`b*****d\`. Use \`*\` for masking.
  * \`"beep"\` → replace offensive token with \`[BEEP]\`.
* Transcript (with actions):
  * \`"verbatim"\` → leave as-is.
  * \`"mask"\` → same masking pattern as above.
  * \`"beep"\` → replace offensive token with \`[beep]\` and add a short note once at the end of that line: \`[slur masked]\` (do **not** add notes in subtitles).
* Never invent or expand slurs. Do not censor brand names or proper nouns unless they actually are slurs in context.
* Keep punctuation and timing intact. Do not merge/split cues solely due to masking.

## Output Contract (always return this JSON envelope)
\`\`\`json
{
  "status": "ok" | "error",
  "errors": [ { "code": "...", "message": "...", "details": {} } ],
  "metadata": {
    "language": "auto-detected BCP-47 code if known",
    "duration_s": 0,
    "speaker_count": 0,
    "confidence_overall": 0.0,
    "profanity_mode": "<verbatim|mask|beep>",
    "masked_terms_count": 0,
    "beeped_terms_count": 0
  },
  "subtitles_vtt": "WEBVTT\\n... full file ...",
  "transcript_markdown": "# Transcript (with actions)\\n... full text ..."
}
\`\`\`

## Error Handling & Quality Checks
* Follow standard error codes: \`FILE_TOO_LARGE\`, \`UNSUPPORTED_FORMAT\`, etc.
* Ensure \`subtitles_vtt\` starts with \`WEBVTT\`.
* Actions appear **only** in \`transcript_markdown\`.
* Times are monotonically increasing.`;

const generationUserPromptTemplate = (profanityMode: string) => `You will receive one video file.
Please analyze it and return **both**:

1. \`subtitles_vtt\` — spoken words only, in WebVTT format.
2. \`transcript_markdown\` — speech **plus** concise bracketed action notes.

Runtime parameter:
safety.profanity_mode = "${profanityMode}"

Follow the **Output Contract** and **Error Handling Rules** from the system instructions.
**Deliver only the JSON envelope** specified.`;

export const generateTranscriptAndSubtitles = async (
    videoFile: File,
    profanityMode: 'verbatim' | 'mask' | 'beep',
    onProgress: (message: string) => void
): Promise<GenerationResult> => {
    
    if (videoFile.size > 500 * 1024 * 1024) { // 500 MB check
        throw new Error("File is too large. Please upload a video under 500 MB.");
    }
    
    try {
        // Step 1: Upload the file using the File API to avoid client-side memory issues.
        onProgress(`Uploading video... This may take a while for large files.`);
        // FIX: The error indicates `displayName` is not a valid property for `ai.files.upload` in the used SDK version.
        const uploadResponse = await ai.files.upload({
            file: videoFile,
        });

        // FIX: The error "Property 'file' does not exist on type 'File_2'" suggests that
        // `ai.files.upload()` returns the File object directly, not a wrapper object.
        let uploadedFile = uploadResponse;
        onProgress('File uploaded. Server is processing the video...');

        // Step 2: Poll for the file to become ACTIVE on the server.
        while (uploadedFile.state === FileState.PROCESSING) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
            const getFileResponse = await ai.files.get({name: uploadedFile.name});
            // FIX: The error suggests `ai.files.get()` also returns the File object directly.
            uploadedFile = getFileResponse;
        }

        if (uploadedFile.state !== FileState.ACTIVE) {
            throw new Error(`File processing failed on the server. Status: ${uploadedFile.state}`);
        }
        
        onProgress('Video processed. Preparing AI analysis...');

        // Step 3: Use the uploaded file's URI in the generateContent call.
        const videoPart = {
            fileData: {
                mimeType: videoFile.type,
                fileUri: uploadedFile.uri,
            },
        };

        const userPrompt = generationUserPromptTemplate(profanityMode);
        onProgress('Analyzing video... this may take several minutes.');
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [videoPart, { text: userPrompt }] },
            config: {
                systemInstruction: generationSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: generationResponseSchema,
            },
        });

        const jsonText = response.text.trim();
        
        // Clean up the uploaded file after processing.
        await ai.files.delete({ name: uploadedFile.name });
        
        return JSON.parse(jsonText) as GenerationResult;

    } catch (error) {
        console.error("Error during the generation process:", error);
        if (error instanceof Error) {
            throw new Error(`The AI process failed: ${error.message}`);
        }
        throw new Error("An unknown error occurred during the AI process.");
    }
};


// --- TRANSLATION ---

const translationSystemInstruction = `You receive a JSON envelope previously produced by our pipeline. Your task: create **faithful translations** into these target languages: \`["es","de","it","fr","nl"]\`

## Output Contract
Return a JSON object:
\`\`\`json
{
  "status": "ok" | "error",
  "errors": [ { "code": "...", "message": "...", "details": {} } ],
  "translations": {
    "es": { "subtitles_vtt": "...", "transcript_markdown": "..." },
    "de": { "...": "..." },
    "it": { "...": "..." },
    "fr": { "...": "..." },
    "nl": { "...": "..." }
  }
}
\`\`\`

## Rules
* **Preserve timing & structure**: In every \`.vtt\`, keep all cue indices, start/end times, line breaks, and cue count identical to the source. **Translate text only.**
* **Bracketed items**: Keep square brackets. Translate the action text inside (e.g., \`[applause]\` → \`[aplausos]\`, \`[BEEP]\` stays \`[BEEP]\` unchanged).
* **Profanity handling**: If the source contains \`[BEEP]\` or masked words (\`f***\`), keep the **same pattern and length** in the translation.
* **Proper nouns/brands**: keep as-is unless there’s a well-established localized exonym.
* **Validation**: Every target’s \`subtitles_vtt\` must start with \`WEBVTT\` and have the same number of cues as the source.
* **Error handling**: If the input envelope is malformed, return \`status:"error"\`, \`code:"INVALID_INPUT"\`.`;

const translationResponseSchema = {
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
                    details: { type: Type.OBJECT }
                },
                required: ["code", "message"]
            }
        },
        translations: {
            type: Type.OBJECT,
            properties: {
                es: {
                    type: Type.OBJECT,
                    properties: {
                        subtitles_vtt: { type: Type.STRING },
                        transcript_markdown: { type: Type.STRING }
                    },
                    required: ["subtitles_vtt", "transcript_markdown"]
                },
                de: {
                    type: Type.OBJECT,
                    properties: {
                        subtitles_vtt: { type: Type.STRING },
                        transcript_markdown: { type: Type.STRING }
                    },
                    required: ["subtitles_vtt", "transcript_markdown"]
                },
                it: {
                    type: Type.OBJECT,
                    properties: {
                        subtitles_vtt: { type: Type.STRING },
                        transcript_markdown: { type: Type.STRING }
                    },
                    required: ["subtitles_vtt", "transcript_markdown"]
                },
                fr: {
                    type: Type.OBJECT,
                    properties: {
                        subtitles_vtt: { type: Type.STRING },
                        transcript_markdown: { type: Type.STRING }
                    },
                    required: ["subtitles_vtt", "transcript_markdown"]
                },
                nl: {
                    type: Type.OBJECT,
                    properties: {
                        subtitles_vtt: { type: Type.STRING },
                        transcript_markdown: { type: Type.STRING }
                    },
                    required: ["subtitles_vtt", "transcript_markdown"]
                }
            },
            required: ["es", "de", "it", "fr", "nl"]
        }
    },
    required: ["status", "translations"]
};


export const translateContent = async (
    generationResult: GenerationResult
): Promise<TranslationResult> => {
    
    const userPrompt = JSON.stringify(generationResult, null, 2);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: userPrompt }] },
            config: {
                systemInstruction: translationSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: translationResponseSchema,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as TranslationResult;

    } catch (error) {
        console.error("Error calling Gemini API for translation:", error);
        if (error instanceof Error) {
            throw new Error(`Could not translate content from the AI model: ${error.message}`);
        }
        throw new Error("An unknown error occurred while contacting the AI model for translation.");
    }
};
