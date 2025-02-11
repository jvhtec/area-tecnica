
import { useEffect, useState, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a'
];

const TAP_TIMEOUT = 2000; // Reset tap sequence after 2 seconds of inactivity
const LOGO_TAP_COUNT = 5; // Number of times to tap the logo

export const useKonamiCode = () => {
  const [keys, setKeys] = useState<string[]>([]);
  const [triggered, setTriggered] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const isMobile = useIsMobile();

  const resetTapCount = useCallback(() => {
    setTapCount(0);
    setLastTapTime(0);
  }, []);

  const handleLogoTap = useCallback(() => {
    const now = Date.now();
    
    // Reset if too much time has passed since last tap
    if (now - lastTapTime > TAP_TIMEOUT) {
      resetTapCount();
    }
    
    setLastTapTime(now);
    setTapCount(prev => {
      const newCount = prev + 1;
      if (newCount >= LOGO_TAP_COUNT) {
        console.log('Logo tap sequence completed!');
        setTriggered(true);
        return 0;
      }
      return newCount;
    });
  }, [lastTapTime, resetTapCount]);

  useEffect(() => {
    if (!isMobile) {
      const handleKeyDown = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        console.log('Key pressed:', key);
        
        setKeys(prevKeys => {
          const updatedKeys = [...prevKeys, key];
          const slicedKeys = updatedKeys.slice(-KONAMI_CODE.length);
          
          // Check if the konami code has been entered
          const isKonamiCode = slicedKeys.join(',').toLowerCase() === 
            KONAMI_CODE.join(',').toLowerCase();
          
          if (isKonamiCode) {
            console.log('Konami code triggered!');
            setTriggered(true);
          }
          
          return slicedKeys;
        });
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMobile]);

  const reset = useCallback(() => {
    setTriggered(false);
    setKeys([]);
    resetTapCount();
  }, [resetTapCount]);

  return { triggered, reset, handleLogoTap, tapCount };
};
