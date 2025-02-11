
import { useEffect, useState } from 'react';

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

export const useKonamiCode = () => {
  const [keys, setKeys] = useState<string[]>([]);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
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
  }, []);

  const reset = () => {
    setTriggered(false);
    setKeys([]);
  };

  return { triggered, reset };
};
