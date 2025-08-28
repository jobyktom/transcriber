
import React from 'react';
import { DownloadIcon } from './icons';

interface SubtitleDownloaderProps {
  content: string;
  filename: string;
}

export const SubtitleDownloader: React.FC<SubtitleDownloaderProps> = ({ content, filename }) => {
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
    >
      <DownloadIcon />
      Download Subtitles (.vtt)
    </button>
  );
};
