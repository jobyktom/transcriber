import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon } from './icons';

interface VideoUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !disabled) {
      onFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [onFileSelect, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && !disabled) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleClick = () => {
    if(!disabled) {
        fileInputRef.current?.click();
    }
  };

  const dynamicClasses = isDragging
    ? 'border-[#d4af37] bg-[#d4af37]/10 ring-2 ring-[#d4af37]'
    : 'border-[#4a4a4a] hover:border-[#6a6a6a] hover:bg-[#1a1a1a]/50';

  return (
    <div
      className={`relative w-full p-10 border rounded-lg text-center transition-all duration-300 cursor-pointer ${dynamicClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <div className="flex flex-col items-center justify-center text-gray-400">
        <UploadIcon />
        <p className="mt-4 text-lg font-semibold text-gray-200">
            {isDragging ? "Drop video to upload" : "Drag & drop or click to upload"}
        </p>
        <p className="text-sm text-gray-500 mt-1">Supports MP4, MOV, WebM, etc. (Max 500MB)</p>
      </div>
    </div>
  );
};