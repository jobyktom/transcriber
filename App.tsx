import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { VideoUpload } from './components/VideoUpload';
import { VideoPlayer } from './components/VideoPlayer';
import { TranscriptDisplay } from './components/TranscriptDisplay';
import { SubtitleDownloader } from './components/SubtitleDownloader';
import { Loader } from './components/Loader';
import { generateTranscriptAndSubtitles, translateContent } from './services/geminiService';
import type { TranscriptSegment, GenerationResult, Translations } from './types';
import { GenerateIcon, TranslateIcon, ArchiveIcon } from './components/icons';
import { ProfanityControl } from './components/ProfanityControl';

declare var JSZip: any;

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [translations, setTranslations] = useState<Translations | null>(null);
  
  const [profanityMode, setProfanityMode] = useState<'verbatim' | 'mask' | 'beep'>('verbatim');
  const [activeLanguage, setActiveLanguage] = useState<string>('en');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  
  const [currentTime, setCurrentTime] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = (file: File) => {
    resetState();
    if (file.type.startsWith('video/')) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setError(null);
    } else {
      setError('Please upload a valid video file.');
    }
  };

  const resetState = () => {
    setVideoFile(null);
    if(videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setVideoDuration(0);
    setGenerationResult(null);
    setTranslations(null);
    setIsLoading(false);
    setIsTranslating(false);
    setError(null);
    setTranslationError(null);
    setProgressMessage('');
    setCurrentTime(0);
    setActiveLanguage('en');
  };

  const handleGenerate = async () => {
    if (!videoFile) {
      setError('Please upload a video before generating.');
      return;
    }

    if (videoDuration <= 0 || !Number.isFinite(videoDuration)) {
      setError('Could not determine a valid video duration. The video file may be corrupt or still loading.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGenerationResult(null);
    setTranslations(null);
    setActiveLanguage('en');
    setProgressMessage('Starting generation process...');

    try {
      const result = await generateTranscriptAndSubtitles(videoFile, profanityMode, setProgressMessage);
      
      if (result.status === 'error' || !result.subtitles_vtt || !result.transcript_json) {
        throw new Error(result.errors?.[0]?.message || 'AI generation failed with an unknown error.');
      }
      setGenerationResult(result);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to generate content: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setProgressMessage('');
    }
  };

  const handleTranslate = async () => {
    if (!generationResult) {
      setTranslationError('Cannot translate without a generated transcript.');
      return;
    }
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const result = await translateContent(generationResult);
      if(result.status === 'error') {
        throw new Error(result.errors?.[0]?.message || 'AI translation failed with an unknown error.');
      }
      setTranslations(result.translations);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setTranslationError(`Failed to translate content: ${errorMessage}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!generationResult || !translations || !videoFile) return;
    
    if (typeof JSZip === 'undefined') {
      setTranslationError("Could not create zip file. JSZip library is missing.");
      return;
    }

    const zip = new JSZip();
    const baseFilename = videoFile.name.replace(/\.[^/.]+$/, "");

    // Add original English files
    zip.file(`${baseFilename}-en.json`, JSON.stringify(generationResult.transcript_json, null, 2));
    zip.file(`${baseFilename}-en.vtt`, generationResult.subtitles_vtt);

    // Add translated files
    for (const lang in translations) {
      if (Object.prototype.hasOwnProperty.call(translations, lang)) {
        const translation = translations[lang as keyof Translations];
        zip.file(`${baseFilename}-${lang}.json`, JSON.stringify(translation.transcript_json, null, 2));
        zip.file(`${baseFilename}-${lang}.vtt`, translation.subtitles_vtt);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFilename}-all-languages.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSegmentClick = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const displayedContent = useMemo(() => {
    if (activeLanguage === 'en' || !translations) {
      return {
        transcript: generationResult?.transcript_json,
        subtitles: generationResult?.subtitles_vtt,
        lang: 'en'
      };
    }
    const translation = translations[activeLanguage as keyof Translations];
    return {
      transcript: translation?.transcript_json,
      subtitles: translation?.subtitles_vtt,
      lang: activeLanguage
    };
  }, [activeLanguage, generationResult, translations]);
  
  const displayedSegments = displayedContent.transcript || [];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="flex flex-col gap-6 bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
            <h2 className="text-2xl font-bold text-cyan-400">1. Upload Your Video</h2>
            <VideoUpload onFileSelect={handleFileSelect} disabled={isLoading || isTranslating} />
            {videoUrl && (
              <div className="mt-4">
                <VideoPlayer 
                  src={videoUrl} 
                  videoRef={videoRef}
                  onTimeUpdate={setCurrentTime}
                  onMetadataLoad={setVideoDuration}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6 bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">2. Generate Content</h2>
              <ProfanityControl mode={profanityMode} onModeChange={setProfanityMode} disabled={isLoading || isTranslating} />
              <button
                onClick={handleGenerate}
                disabled={!videoFile || isLoading || isTranslating}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition duration-300"
                aria-label="Generate transcript and subtitles"
              >
                <GenerateIcon />
                {isLoading ? 'Generating...' : 'Generate Transcript & Subtitles'}
              </button>
            </div>
            
            <div className="border-t border-gray-700 pt-6">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">3. Results</h2>
              {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg" role="alert">{error}</div>}
              {isLoading && <Loader message={progressMessage} />}
              
              {!isLoading && !error && generationResult && (
                <>
                  {generationResult.metadata && (
                    <div className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-md mb-4 space-y-1">
                       <p><strong>Language:</strong> {generationResult.metadata.language || 'N/A'}</p>
                       <p><strong>Profanity Mode:</strong> <span className="font-mono bg-gray-700 px-1 rounded">{generationResult.metadata.profanity_mode}</span></p>
                       {generationResult.metadata.profanity_mode === 'mask' && <p><strong>Masked Terms:</strong> {generationResult.metadata.masked_terms_count}</p>}
                       {generationResult.metadata.profanity_mode === 'beep' && <p><strong>Beeped Terms:</strong> {generationResult.metadata.beeped_terms_count}</p>}
                    </div>
                  )}

                  {/* --- Translation UI Block --- */}
                  {isTranslating ? (
                    <Loader message="Translating content..." />
                  ) : translations ? (
                    <div>
                      <div className="flex space-x-1 mb-4 border-b border-gray-700">
                        {['en', 'es', 'de', 'it', 'fr', 'nl'].map(lang => (
                          <button key={lang} onClick={() => setActiveLanguage(lang)} className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeLanguage === lang ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                            {lang.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleDownloadAll}
                        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 mb-4"
                      >
                        <ArchiveIcon />
                        Download All Languages (.zip)
                      </button>
                    </div>
                  ) : (
                    <>
                      {translationError && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg my-4" role="alert">{translationError}</div>}
                      <button
                        onClick={handleTranslate}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 mb-4"
                      >
                        <TranslateIcon />
                        Translate to 5 Languages
                      </button>
                    </>
                  )}

                  <TranscriptDisplay 
                    segments={displayedSegments} 
                    currentTime={currentTime}
                    onSegmentClick={handleSegmentClick} 
                  />

                  <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    {displayedContent.transcript && (
                      <SubtitleDownloader
                        content={JSON.stringify(displayedContent.transcript, null, 2)}
                        filename={`${videoFile?.name.replace(/\.[^/.]+$/, "")}-${displayedContent.lang}.json`}
                        buttonText={`Download Transcript (.json)`}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      />
                    )}
                    {displayedContent.subtitles && (
                      <SubtitleDownloader
                        content={displayedContent.subtitles}
                        filename={`${videoFile?.name.replace(/\.[^/.]+$/, "")}-${displayedContent.lang}.vtt`}
                        buttonText={`Download Subtitles (.vtt)`}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      />
                    )}
                  </div>
                </>
              )}

              {!isLoading && !generationResult && !error && (
                <div className="text-center py-10 px-4 bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-700">
                  <p className="text-gray-500">Your generated transcript and subtitles will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;