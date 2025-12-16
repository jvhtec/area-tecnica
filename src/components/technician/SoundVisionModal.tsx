import React from 'react';
import { Theme } from '@/components/technician/types';
import { SoundVisionInteractiveMap } from '@/components/soundvision/SoundVisionInteractiveMap';

interface SoundVisionModalProps {
  theme: Theme;
  isDark: boolean;
  onClose: () => void;
}

export const SoundVisionModal = ({ theme, isDark, onClose }: SoundVisionModalProps) => {
  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <SoundVisionInteractiveMap theme={theme} isDark={isDark} onClose={onClose} />
    </div>
  );
};
