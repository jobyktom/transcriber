
export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

export interface GenerationError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface GenerationMetadata {
  language?: string;
  duration_s?: number;
  speaker_count?: number;
  confidence_overall?: number;
  profanity_mode: "verbatim" | "mask" | "beep";
  masked_terms_count: number;
  beeped_terms_count: number;
}

export interface GenerationResult {
  status: "ok" | "error";
  errors?: GenerationError[];
  metadata: GenerationMetadata;
  subtitles_vtt: string;
  transcript_markdown: string;
}

export interface Translation {
  subtitles_vtt: string;
  transcript_markdown: string;
}

export interface Translations {
  es: Translation;
  de: Translation;
  it: Translation;
  fr: Translation;
  nl: Translation;
}

export interface TranslationResult {
    status: "ok" | "error";
    errors?: GenerationError[];
    translations: Translations;
}
