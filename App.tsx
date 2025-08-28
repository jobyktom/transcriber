import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { VideoUpload } from './components/VideoUpload';
import { VideoPlayer } from './components/VideoPlayer';
import { TranscriptDisplay } from './components/TranscriptDisplay';
import { Loader } from './components/Loader';
import { generateTranscriptAndSubtitles, translateContent } from './services/geminiService';
import type { GenerationResult, Translations } from './types';
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
    setTranslationError(null);
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

  const handleDownloadZip = async (scope: 'en' | 'all') => {
    if (!generationResult || !videoFile) return;

    if (typeof JSZip === 'undefined') {
        const errorMsg = "Could not create zip file. JSZip library is missing.";
        if (scope === 'all') setTranslationError(errorMsg);
        else setError(errorMsg);
        return;
    }

    const zip = new JSZip();
    const baseFilename = videoFile.name.replace(/\.[^/.]+$/, "");

    zip.file(`${baseFilename}-en.json`, JSON.stringify(generationResult.transcript_json, null, 2));
    zip.file(`${baseFilename}-en.vtt`, generationResult.subtitles_vtt);

    let downloadFilename = `${baseFilename}-results.zip`;

    if (scope === 'all' && translations) {
        downloadFilename = `${baseFilename}-all-languages.zip`;
        for (const lang in translations) {
            if (Object.prototype.hasOwnProperty.call(translations, lang)) {
                const translation = translations[lang as keyof Translations];
                zip.file(`${baseFilename}-${lang}.json`, JSON.stringify(translation.transcript_json, null, 2));
                zip.file(`${baseFilename}-${lang}.vtt`, translation.subtitles_vtt);
            }
        }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
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

  const displayedSegments = useMemo(() => {
    if (activeLanguage === 'en' || !translations) {
      return generationResult?.transcript_json || [];
    }
    return translations[activeLanguage as keyof Translations]?.transcript_json || [];
  }, [activeLanguage, generationResult, translations]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#f0f0f0] flex flex-col font-sans">
      <Header />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          <div className="flex flex-col gap-8 bg-[#2b2b2b] p-8 rounded-xl border border-[#3a3a3a]">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-white">1. Upload Video</h2>
              <p className="text-gray-400">Select a video file from your computer to begin.</p>
            </div>
            <VideoUpload onFileSelect={handleFileSelect} disabled={isLoading || isTranslating} />
            {videoUrl && (
              <div className="mt-2">
                <VideoPlayer 
                  src={videoUrl} 
                  videoRef={videoRef}
                  onTimeUpdate={setCurrentTime}
                  onMetadataLoad={setVideoDuration}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-8 bg-[#2b2b2b] p-8 rounded-xl border border-[#3a3a3a]">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-white">2. Configure & Generate</h2>
              <p className="text-gray-400">Set your content preferences and start the AI process.</p>
            </div>
            <ProfanityControl mode={profanityMode} onModeChange={setProfanityMode} disabled={isLoading || isTranslating} />
            <button
              onClick={handleGenerate}
              disabled={!videoFile || isLoading || isTranslating}
              className="w-full flex items-center justify-center gap-3 bg-[#d4af37] hover:bg-[#c8a230] disabled:bg-[#4a4a4a] disabled:text-gray-500 disabled:cursor-not-allowed text-[#1a1a1a] font-bold py-3 px-4 rounded-lg transition-all duration-300 transform active:scale-95"
              aria-label="Generate transcript and subtitles"
            >
              <GenerateIcon />
              {isLoading ? 'Generating...' : 'Generate Content'}
            </button>
            
            <div className="border-t border-[#3a3a3a] pt-8 flex flex-col gap-6">
              <h2 className="text-2xl font-bold text-white">3. Results</h2>
              {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg" role="alert">{error}</div>}
              {isLoading && <Loader message={progressMessage} />}
              
              {!isLoading && !error && generationResult && (
                <div className="flex flex-col gap-6">
                  {generationResult.metadata && (
                    <div className="text-sm text-gray-400 bg-[#1a1a1a] p-4 rounded-lg space-y-2 border border-[#3a3a3a]">
                       <p><strong>Language:</strong> {generationResult.metadata.language || 'N/A'}</p>
                       <p><strong>Profanity Mode:</strong> <span className="font-mono bg-[#3a3a3a] px-1.5 py-0.5 rounded text-gray-300">{generationResult.metadata.profanity_mode}</span></p>
                       {generationResult.metadata.profanity_mode === 'mask' && <p><strong>Masked Terms:</strong> {generationResult.metadata.masked_terms_count}</p>}
                       {generationResult.metadata.profanity_mode === 'beep' && <p><strong>Beeped Terms:</strong> {generationResult.metadata.beeped_terms_count}</p>}
                    </div>
                  )}

                  {/* --- Actions & Tabs Section --- */}
                  <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#3a3a3a]">
                      {isTranslating ? (
                          <Loader message="Translating content..." />
                      ) : translations ? (
                          <div className="flex flex-col gap-4">
                              <div className="flex space-x-1">
                                  {['en', 'es', 'de', 'it', 'fr', 'nl'].map(lang => (
                                      <button key={lang} onClick={() => setActiveLanguage(lang)} className={`flex-1 px-3 py-2 text-sm font-semibold rounded-t-md transition-colors ${activeLanguage === lang ? 'bg-[#3a3a3a] text-white' : 'text-gray-400 hover:bg-[#2b2b2b]'}`}>
                                          {lang.toUpperCase()}
                                      </button>
                                  ))}
                              </div>
                              <button onClick={() => handleDownloadZip('all')} className="w-full flex items-center justify-center gap-3 bg-[#d4af37] hover:bg-[#c8a230] text-[#1a1a1a] font-bold py-3 px-4 rounded-lg transition-all duration-300 transform active:scale-95">
                                  <ArchiveIcon />
                                  Download All Languages (.zip)
                              </button>
                          </div>
                      ) : (
                          <div className="flex flex-col sm:flex-row gap-4">
                              <button onClick={() => handleDownloadZip('en')} className="flex-1 flex items-center justify-center gap-3 bg-[#d4af37] hover:bg-[#c8a230] text-[#1a1a1a] font-bold py-3 px-4 rounded-lg transition-all duration-300 transform active:scale-95">
                                  <ArchiveIcon />
                                  Download Results (.zip)
                              </button>
                              <button onClick={handleTranslate} className="flex-1 flex items-center justify-center gap-3 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform active:scale-95">
                                  <TranslateIcon />
                                  Translate to 5 Languages
                              </button>
                          </div>
                      )}
                      {translationError && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg mt-4" role="alert">{translationError}</div>}
                  </div>

                  <TranscriptDisplay 
                    segments={displayedSegments} 
                    currentTime={currentTime}
                    onSegmentClick={handleSegmentClick} 
                  />
                </div>
              )}

              {!isLoading && !generationResult && !error && (
                <div className="text-center py-10 px-4 bg-[#1a1a1a] rounded-lg border-2 border-dashed border-[#3a3a3a]">
                  <p className="text-gray-500">Your generated transcript will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer error={error} translationError={translationError} />
    </div>
  );
};

export default App;