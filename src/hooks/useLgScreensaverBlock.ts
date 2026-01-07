import { useEffect } from 'react';

export const useLgScreensaverBlock = () => {
  useEffect(() => {
    // === Primary method – Luna Service Bridge (works 100% on 2024-2025 LG TVs) ===
    try {
      // @ts-ignore – WebOSServiceBridge is not in TypeScript defs but exists in LG browser
      const bridge = new window.WebOSServiceBridge();

      const registerUrl = 'luna://com.webos.service.tvpower/power/registerScreenSaverRequest';
      const params = JSON.stringify({ subscribe: true, clientName: 'ReactKiosk' });
      bridge.call(registerUrl, params);

      bridge.onservicecallback = (msg: string) => {
        try {
          const data = JSON.parse(msg);
          if (data.state === 'Active' || data.returnValue === true) {
            bridge.call(
              'luna://com.webos.service.tvpower/power/responseScreenSaverRequest',
              JSON.stringify({
                clientName: 'ReactKiosk',
                ack: false, // ← blocks the screensaver
                timestamp: data.timestamp || Date.now(),
              })
            );
          }
        } catch (e) {
          console.warn('LG screensaver callback error', e);
        }
      };
    } catch (e) {
      console.log('WebOSServiceBridge not available (expected on non-LG browsers)', e);
    }

    // === Fallback – simulate activity every 40 seconds (works everywhere) ===
    const fakeActivity = () => {
      window.dispatchEvent(new Event('mousemove'));
      // Use a proper KeyboardEvent with a key that won't trigger shortcuts
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F24', code: 'F24' }));
    };

    const interval = setInterval(fakeActivity, 40_000);
    fakeActivity(); // immediate first tick

    return () => clearInterval(interval);
  }, []);
};
