import React from 'react';
import type { TranscriptSegment } from '../types';

interface TranscriptDisplayProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSegmentClick: (time: number) => void;
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time % 1) * 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ segments, currentTime, onSegmentClick }) => {
  return (
    <div className="h-96 overflow-y-auto pr-2 bg-[#1a1a1a] p-3 rounded-lg border border-[#3a3a3a]">
      <div className="space-y-4">
        {segments.map((segment, index) => {
          const isActive = currentTime >= segment.start && currentTime < segment.end;
          return (
            <div
              key={index}
              onClick={() => onSegmentClick(segment.start)}
              className={`p-3 rounded-md cursor-pointer transition-all duration-200 border-l-4 ${isActive ? 'bg-[#d4af37]/10 border-[#d4af37]' : 'border-transparent hover:bg-[#2b2b2b]'}`}
            >
              <div className={`font-mono text-sm ${isActive ? 'text-[#d4af37]' : 'text-gray-400'}`}>
                {formatTime(segment.start)}
              </div>
              <p className={`mt-1 text-base ${isActive ? 'text-white' : 'text-gray-300'}`}>
                {segment.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};