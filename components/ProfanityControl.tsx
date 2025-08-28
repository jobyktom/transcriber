import React from 'react';

type ProfanityMode = 'verbatim' | 'mask' | 'beep';

interface ProfanityControlProps {
  mode: ProfanityMode;
  onModeChange: (mode: ProfanityMode) => void;
  disabled: boolean;
}

const options: { value: ProfanityMode, label: string }[] = [
  { value: 'verbatim', label: 'Verbatim' },
  { value: 'mask', label: 'Mask' },
  { value: 'beep', label: 'Beep' },
];

export const ProfanityControl: React.FC<ProfanityControlProps> = ({ mode, onModeChange, disabled }) => {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-300 mb-2">Profanity & Slur Control</h3>
      <div className={`flex w-full rounded-lg bg-[#1a1a1a] p-1 border border-[#3a3a3a] ${disabled ? 'opacity-50' : ''}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex-1 p-2 rounded-md text-center cursor-pointer transition-colors duration-200 text-sm font-semibold ${
              mode === option.value ? 'bg-[#d4af37] text-[#1a1a1a]' : 'text-gray-400 hover:bg-[#2b2b2b]'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="profanity-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => onModeChange(option.value)}
              className="sr-only"
              disabled={disabled}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};