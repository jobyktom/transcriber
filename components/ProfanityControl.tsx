
import React from 'react';

type ProfanityMode = 'verbatim' | 'mask' | 'beep';

interface ProfanityControlProps {
  mode: ProfanityMode;
  onModeChange: (mode: ProfanityMode) => void;
  disabled: boolean;
}

const options: { value: ProfanityMode, label: string, description: string }[] = [
  { value: 'verbatim', label: 'Verbatim', description: 'Leave all words as they are.' },
  { value: 'mask', label: 'Mask', description: 'Replace slurs with f***.' },
  { value: 'beep', label: 'Beep', description: 'Replace slurs with [BEEP].' },
];

export const ProfanityControl: React.FC<ProfanityControlProps> = ({ mode, onModeChange, disabled }) => {
  return (
    <div className="my-4">
      <h3 className="text-lg font-semibold text-gray-300 mb-2">Profanity & Slur Control</h3>
      <div className="flex flex-col sm:flex-row gap-2 rounded-lg bg-gray-900/50 p-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex-1 p-3 rounded-md text-center cursor-pointer transition-colors duration-200 ${
              mode === option.value ? 'bg-cyan-800 text-white' : 'bg-gray-800 hover:bg-gray-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            <span className="font-bold block text-sm">{option.label}</span>
            <span className="text-xs text-gray-400">{option.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
