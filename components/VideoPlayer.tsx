
import React from 'react';

interface VideoPlayerProps {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  onTimeUpdate: (time: number) => void;
  onMetadataLoad: (duration: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, videoRef, onTimeUpdate, onMetadataLoad }) => {
  return (
    <video
      ref={videoRef}
      src={src}
      controls
      className="w-full rounded-lg shadow-md aspect-video"
      onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => onMetadataLoad(e.currentTarget.duration)}
    />
  );
};
