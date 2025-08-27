import * as React from "react"

const MOBILE_BREAKPOINT = 768

function detectMobileDevice() {
  // Check user agent for mobile devices
  const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  // Check screen width
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  
  // Check if it's a touch device
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
  
  // iOS specific checks
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  
  // Return true if any mobile indicator is present
  return mobileRegex.test(userAgent) || screenWidth < MOBILE_BREAKPOINT || (isTouchDevice && isIOS);
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(detectMobileDevice())
    }
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", checkMobile)
    
    // Initial check
    checkMobile()
    
    return () => mql.removeEventListener("change", checkMobile)
  }, [])

  return !!isMobile
}
