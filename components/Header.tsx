import React from 'react';
import { DeckersLogo } from './icons';

export const Header: React.FC = () => {
  return (
    <header className="bg-[#2b2b2b]/80 backdrop-blur-sm border-b border-[#3a3a3a] sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
        <DeckersLogo />
        <h1 className="text-xl font-semibold text-white">
          Video Intelligence Platform
        </h1>
      </div>
    </header>
  );
};