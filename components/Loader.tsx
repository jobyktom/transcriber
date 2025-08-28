import React from 'react';

interface LoaderProps {
  message: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-4">
      <div className="w-8 h-8 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-gray-300">{message}</p>
    </div>
  );
};