
import React from 'react';
import { FilmIcon } from './icons';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex items-center gap-3">
        <FilmIcon />
        <h1 className="text-xl font-bold text-white">
          AI Video Transcriber & Subtitler
        </h1>
      </div>
    </header>
  );
};
