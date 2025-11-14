import React, { useEffect, useRef, useState } from 'react';
import { WallboardBgmConfig } from '@/lib/wallboard-api';

interface RadioPlayerProps {
  config: WallboardBgmConfig;
}

/**
 * Hidden audio player for continuous background radio playback on wallboards.
 * Features:
 * - Autoplay with fallback stream rotation
 * - Volume set to 0.3 by default
 * - Handles browser autoplay restrictions with an overlay
 * - No visible controls
 */
export function RadioPlayer({ config }: RadioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const streamsRef = useRef<string[]>([]);

  useEffect(() => {
    const { bgmStreamUrl, bgmFallbacks } = config;

    // No stream URL configured
    if (!bgmStreamUrl) {
      return;
    }

    // Build streams array (primary + fallbacks)
    streamsRef.current = [
      bgmStreamUrl,
      ...(bgmFallbacks || []).filter(Boolean),
    ];

    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    audio.volume = 0.3;
    audio.loop = false; // We'll handle looping ourselves for better error recovery

    // Load the first stream
    loadStream(0);

    function loadStream(index: number) {
      if (!audio || index >= streamsRef.current.length) {
        console.error('RadioPlayer: No more fallback streams available');
        return;
      }

      const streamUrl = streamsRef.current[index];
      console.log(`RadioPlayer: Loading stream ${index + 1}/${streamsRef.current.length}: ${streamUrl}`);

      audio.src = streamUrl;
      setCurrentStreamIndex(index);

      // Attempt to play
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('RadioPlayer: Autoplay blocked by browser', error);
          // Show overlay to enable audio
          setShowOverlay(true);
        });
      }
    }

    // Handle stream errors (try next fallback)
    const handleError = () => {
      console.error(`RadioPlayer: Stream error on ${streamsRef.current[currentStreamIndex]}`);
      const nextIndex = currentStreamIndex + 1;
      if (nextIndex < streamsRef.current.length) {
        loadStream(nextIndex);
      } else {
        console.error('RadioPlayer: All streams failed');
        // Reset to first stream after a delay
        setTimeout(() => loadStream(0), 10000);
      }
    };

    // Handle stream end (loop by reloading)
    const handleEnded = () => {
      console.log('RadioPlayer: Stream ended, restarting');
      audio.play().catch((error) => {
        console.error('RadioPlayer: Failed to restart stream', error);
      });
    };

    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, [config, currentStreamIndex]);

  const handleOverlayClick = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setShowOverlay(false);
        })
        .catch((error) => {
          console.error('RadioPlayer: Failed to start playback after user interaction', error);
        });
    }
  };

  // Don't render anything if no stream URL is configured
  if (!config.bgmStreamUrl) {
    return null;
  }

  return (
    <>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        preload="auto"
      />

      {/* Autoplay enablement overlay */}
      {showOverlay && (
        <div
          onClick={handleOverlayClick}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              background: 'white',
              color: 'black',
              padding: '40px 60px',
              borderRadius: '12px',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
            }}
          >
            <p style={{ margin: 0 }}>Toca para habilitar audio</p>
            <p style={{ margin: '10px 0 0', fontSize: '16px', fontWeight: 'normal', opacity: 0.7 }}>
              (Tap to enable audio)
            </p>
          </div>
        </div>
      )}
    </>
  );
}
