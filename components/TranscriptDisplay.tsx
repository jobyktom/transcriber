
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
    <div className="h-96 overflow-y-auto pr-2 bg-gray-900/70 p-3 rounded-lg border border-gray-700">
      <div className="space-y-4">
        {segments.map((segment, index) => {
          const isActive = currentTime >= segment.startTime && currentTime <= segment.endTime;
          return (
            <div
              key={index}
              onClick={() => onSegmentClick(segment.startTime)}
              className={`p-3 rounded-md cursor-pointer transition-colors duration-200 ${isActive ? 'bg-cyan-900/50' : 'hover:bg-gray-800'}`}
            >
              <div className={`font-mono text-sm ${isActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                {formatTime(segment.startTime)}
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
