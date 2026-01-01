import React, { useEffect, useRef } from 'react';

/**
 * WakeLockVideo
 * 
 * Renders a tiny, invisible, looping video to prevent LG WebOS TVs (and other devices)
 * from activating their screensaver.
 * 
 * This effectively acts as a "media playback" wake lock.
 */
export const WakeLockVideo: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Try to play immediately
        const playVideo = async () => {
            try {
                await video.play();
                console.log('WakeLockVideo: playing successfully');
            } catch (err) {
                console.warn('WakeLockVideo: play failed, retrying on interaction', err);
                // Add a one-time listener to play on first interaction if autoplay is blocked
                const onInteraction = () => {
                    video.play().catch(e => console.error('WakeLockVideo: retry failed', e));
                    window.removeEventListener('click', onInteraction);
                    window.removeEventListener('keydown', onInteraction);
                    window.removeEventListener('touchstart', onInteraction);
                };
                window.addEventListener('click', onInteraction, { once: true });
                window.addEventListener('keydown', onInteraction, { once: true });
                window.addEventListener('touchstart', onInteraction, { passive: true, once: true });
            }
        };

        playVideo();
    }, []);

    return (
        <video
            ref={videoRef}
            // 1x1 pixel transparent/black webm video
            src="data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmRBfX17cD0J+ACHcB2ITO4h2JwtsD0J+AKAA="
            loop
            muted
            autoPlay
            playsInline
            width="1"
            height="1"
            style={{
                position: 'fixed',
                bottom: 0,
                right: 0,
                width: '1px',
                height: '1px',
                opacity: 0.01,
                pointerEvents: 'none',
                zIndex: 0, // Behind everything
            }}
            aria-hidden="true"
        />
    );
};
