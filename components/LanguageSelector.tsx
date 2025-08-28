import React from 'react';
import type { LanguageCode } from '../types';

const AVAILABLE_LANGUAGES: { code: LanguageCode, name: string }[] = [
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'fr', name: 'French' },
  { code: 'nl', name: 'Dutch' },
];

interface LanguageSelectorProps {
  selectedLanguages: LanguageCode[];
  onSelectionChange: (languages: LanguageCode[]) => void;
  disabled: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ selectedLanguages, onSelectionChange, disabled }) => {
  
  const handleToggle = (langCode: LanguageCode) => {
    if (disabled) return;
    const newSelection = selectedLanguages.includes(langCode)
      ? selectedLanguages.filter(l => l !== langCode)
      : [...selectedLanguages, langCode];
    onSelectionChange(newSelection);
  };

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-300 mb-2">Select Languages for Translation</h3>
      <div className={`grid grid-cols-3 sm:grid-cols-5 gap-2 ${disabled ? 'opacity-50' : ''}`}>
        {AVAILABLE_LANGUAGES.map(({ code, name }) => {
          const isSelected = selectedLanguages.includes(code);
          return (
            <button
              key={code}
              onClick={() => handleToggle(code)}
              disabled={disabled}
              className={`p-3 rounded-lg text-center cursor-pointer transition-all duration-200 text-sm font-semibold border ${
                isSelected 
                  ? 'bg-[#d4af37] text-[#1a1a1a] border-[#d4af37]' 
                  : 'bg-[#2b2b2b] text-gray-300 hover:bg-[#3a3a3a] border-[#3a3a3a]'
              } ${disabled ? 'cursor-not-allowed' : ''}`}
              title={name}
            >
              {code.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  );
};