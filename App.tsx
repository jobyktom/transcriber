
import React, { useState, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { VideoUpload } from './components/VideoUpload';
import { VideoPlayer } from './components/VideoPlayer';
import { TranscriptDisplay } from './components/TranscriptDisplay';
import { SubtitleDownloader } from './components/SubtitleDownloader';
import { Loader } from './components/Loader';
import { generateTranscriptAndSubtitles } from './services/geminiService';
import type { TranscriptSegment } from './types';
import { GenerateIcon } from './components/icons';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(null);
  const [subtitles, setSubtitles] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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
    if(videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setVideoDuration(0);
    setTranscript(null);
    setSubtitles(null);
    setIsLoading(false);
    setError(null);
    setProgressMessage('');
    setCurrentTime(0);
  };

  const parseTranscriptMarkdown = (markdown: string, duration: number): TranscriptSegment[] => {
    if (!markdown) return [];
    
    // Find lines that start with a timestamp like (00:00:00.000)
    const lines = markdown.split('\n').filter(line => line.match(/^\(\d{2}:\d{2}:\d{2}\.\d{3}\)/));
    
    const segments = lines.map(line => {
      const match = line.match(/^\((\d{2}):(\d{2}):(\d{2})\.(\d{3})\)\s*(.*)/);
      if (!match) return null;
      
      const [, hours, minutes, seconds, ms, text] = match;
      const startTime = parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10) + parseInt(ms, 10) / 1000;
      
      return { startTime, text: text.trim() };
    }).filter((segment): segment is { startTime: number; text: string; } => segment !== null);

    // Calculate endTime for each segment
    return segments.map((segment, index) => {
      const nextSegment = segments[index + 1];
      const endTime = nextSegment ? nextSegment.startTime : duration;
      return { ...segment, endTime };
    });
  };

  const handleGenerate = async () => {
    if (!videoFile) {
      setError('Please upload a video before generating.');
      return;
    }

    if (videoDuration <= 0 || !Number.isFinite(videoDuration)) {
      setError('Could not determine a valid video duration. The video file may be corrupt, in an unsupported format, or is still loading. Please try a different file if the problem persists.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTranscript(null);
    setSubtitles(null);
    setProgressMessage('Uploading video and warming up the AI model...');

    try {
      setProgressMessage('Analyzing video and generating content... this may take several minutes for longer videos.');
      const result = await generateTranscriptAndSubtitles(videoFile);
      const parsedTranscript = parseTranscriptMarkdown(result.transcript_markdown, videoDuration);
      
      setTranscript(parsedTranscript);
      setSubtitles(result.subtitles_vtt);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to generate content: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setProgressMessage('');
    }
  };

  const handleSegmentClick = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Upload & Player */}
          <div className="flex flex-col gap-6 bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
            <h2 className="text-2xl font-bold text-cyan-400">1. Upload Your Video</h2>
            <VideoUpload onFileSelect={handleFileSelect} disabled={isLoading} />
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

          {/* Right Column: Control & Results */}
          <div className="flex flex-col gap-6 bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">2. Generate Content</h2>
              <p className="text-gray-400 mb-4">Once your video is uploaded, click the button below. The AI will analyze its audio and visual content directly to create an accurate transcript and subtitles.</p>
              <button
                onClick={handleGenerate}
                disabled={!videoFile || isLoading}
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
              
              {!isLoading && !error && transcript && (
                 <TranscriptDisplay 
                  segments={transcript} 
                  currentTime={currentTime}
                  onSegmentClick={handleSegmentClick} 
                />
              )}

              {!isLoading && !error && subtitles && (
                <div className="mt-6">
                  <SubtitleDownloader content={subtitles} filename={videoFile?.name.replace(/\.[^/.]+$/, "") + '.vtt'} />
                </div>
              )}

              {!isLoading && !transcript && !error && (
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
