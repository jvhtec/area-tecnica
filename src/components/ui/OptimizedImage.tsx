/**
 * OptimizedImage Component
 *
 * Lazy-loading image component optimized for mobile performance.
 * Features:
 * - Intersection Observer for lazy loading
 * - Placeholder blur/skeleton while loading
 * - Error handling with fallback
 * - LQIP (Low Quality Image Placeholder) support
 * - Native lazy loading fallback
 */

import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional low-quality placeholder image */
  placeholder?: string;
  /** Fallback image on error */
  fallback?: string;
  /** Enable blur transition */
  blur?: boolean;
  /** Custom className */
  className?: string;
  /** Container className */
  containerClassName?: string;
  /** Aspect ratio (e.g., "16/9", "1/1", "4/3") */
  aspectRatio?: string;
  /** Loading mode: "lazy" | "eager" */
  loading?: 'lazy' | 'eager';
  /** Whether to show skeleton while loading */
  showSkeleton?: boolean;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback when image fails */
  onError?: () => void;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Object fit mode */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

// Default placeholder - 1x1 transparent pixel
const TRANSPARENT_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Default error fallback
const DEFAULT_FALLBACK = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIj48L3JlY3Q+PGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiPjwvY2lyY2xlPjxwb2x5bGluZSBwb2ludHM9IjIxIDE1IDE2IDEwIDUgMjEiPjwvcG9seWxpbmU+PC9zdmc+';

function OptimizedImageComponent({
  src,
  alt,
  placeholder,
  fallback = DEFAULT_FALLBACK,
  blur = true,
  className,
  containerClassName,
  aspectRatio,
  loading = 'lazy',
  showSkeleton = true,
  onLoad,
  onError,
  rootMargin = '200px',
  objectFit = 'cover',
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(loading === 'eager');
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(
    loading === 'eager' ? src : (placeholder || TRANSPARENT_PLACEHOLDER)
  );
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (loading === 'eager' || isInView) return;

    const container = containerRef.current;
    if (!container) return;

    // Use native lazy loading if IntersectionObserver not available
    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      setCurrentSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            setCurrentSrc(src);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold: 0,
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [src, loading, rootMargin, isInView]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback(() => {
    setHasError(true);
    setCurrentSrc(fallback);
    onError?.();
  }, [fallback, onError]);

  // Update src when prop changes
  useEffect(() => {
    if (isInView && !hasError) {
      setCurrentSrc(src);
      setIsLoaded(false);
    }
  }, [src, isInView, hasError]);

  const aspectRatioStyle = aspectRatio
    ? { aspectRatio }
    : undefined;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        containerClassName
      )}
      style={aspectRatioStyle}
    >
      {/* Skeleton placeholder */}
      {showSkeleton && !isLoaded && !hasError && (
        <div
          className={cn(
            'absolute inset-0 bg-muted animate-pulse',
            blur && 'backdrop-blur-sm'
          )}
        />
      )}

      {/* Placeholder image (LQIP) */}
      {placeholder && !isLoaded && !hasError && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 w-full h-full',
            blur && 'blur-lg scale-110',
            className
          )}
          style={{ objectFit }}
        />
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'w-full h-full transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        style={{ objectFit }}
        {...props}
      />
    </div>
  );
}

export const OptimizedImage = memo(OptimizedImageComponent);

// ============================================
// AVATAR IMAGE (optimized for small circular images)
// ============================================

interface AvatarImageProps {
  src?: string | null;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fallbackInitials?: string;
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

function AvatarImageComponent({
  src,
  alt,
  size = 'md',
  fallbackInitials,
  className,
}: AvatarImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  const initials = fallbackInitials || alt
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const showFallback = !src || hasError;

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden bg-muted flex items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      {showFallback ? (
        <span className="font-medium text-muted-foreground">
          {initials}
        </span>
      ) : (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-200',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
          />
        </>
      )}
    </div>
  );
}

export const AvatarImage = memo(AvatarImageComponent);

// ============================================
// BACKGROUND IMAGE (for hero sections, cards)
// ============================================

interface BackgroundImageProps {
  src: string;
  children?: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  placeholder?: string;
  blur?: boolean;
}

function BackgroundImageComponent({
  src,
  children,
  className,
  overlayClassName,
  placeholder,
  blur = true,
}: BackgroundImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.src = src;
  }, [src, isInView]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
    >
      {/* Placeholder */}
      {placeholder && !isLoaded && (
        <div
          className={cn(
            'absolute inset-0 bg-cover bg-center',
            blur && 'blur-lg scale-110'
          )}
          style={{ backgroundImage: `url(${placeholder})` }}
        />
      )}

      {/* Main background */}
      <div
        className={cn(
          'absolute inset-0 bg-cover bg-center transition-opacity duration-500',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        style={{ backgroundImage: `url(${src})` }}
      />

      {/* Overlay */}
      {overlayClassName && (
        <div className={cn('absolute inset-0', overlayClassName)} />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export const BackgroundImage = memo(BackgroundImageComponent);

// ============================================
// IMAGE PRELOADER (for critical images)
// ============================================

export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = url;
        })
    )
  );
}

export function usePreloadImages(urls: string[]): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (urls.length === 0) {
      setLoaded(true);
      return;
    }

    preloadImages(urls)
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true));
  }, [urls.join(',')]);

  return loaded;
}

export default OptimizedImage;
