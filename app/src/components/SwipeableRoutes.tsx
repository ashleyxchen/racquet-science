/**
 * SwipeableRoutes - iOS-style swipe-to-go-back with real page stack
 *
 * Features:
 * - Maintains a stack of rendered pages
 * - Previous page is actually rendered (not a placeholder)
 * - Current page follows finger during swipe
 * - Smooth iOS-like transitions
 */

import { ReactNode, useRef, useState, useCallback, useEffect, cloneElement, isValidElement, Children } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface PageEntry {
  path: string;
  element: ReactNode;
  key: string;
}

interface SwipeableRoutesProps {
  children: ReactNode;
}

// Swipe detection settings
const EDGE_WIDTH = 40;
const SWIPE_THRESHOLD = 0.3;
const VELOCITY_THRESHOLD = 0.5;

// Pages where swipe-back should be disabled
const DISABLE_SWIPE_PAGES = ['/record-wizard'];

// Max pages to keep in stack
const MAX_STACK_SIZE = 5;

export function SwipeableRoutes({ children }: SwipeableRoutesProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Page stack - keeps previous pages rendered
  const [pageStack, setPageStack] = useState<PageEntry[]>([]);
  const lastPathRef = useRef<string>('');
  const isGoingBackRef = useRef(false);

  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number; startedInEdge: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update page stack when location changes
  useEffect(() => {
    const currentPath = location.pathname;

    if (currentPath === lastPathRef.current) return;

    setPageStack(prev => {
      // Check if we're going back (current path matches a previous page)
      const existingIndex = prev.findIndex(p => p.path === currentPath);

      if (existingIndex !== -1 && existingIndex < prev.length - 1) {
        // Going back - remove pages after this one
        isGoingBackRef.current = true;
        return prev.slice(0, existingIndex + 1);
      }

      // Going forward - add new page
      isGoingBackRef.current = false;
      const newEntry: PageEntry = {
        path: currentPath,
        element: children,
        key: `${currentPath}-${Date.now()}`,
      };

      const newStack = [...prev, newEntry];
      // Limit stack size
      if (newStack.length > MAX_STACK_SIZE) {
        return newStack.slice(-MAX_STACK_SIZE);
      }
      return newStack;
    });

    lastPathRef.current = currentPath;
  }, [location.pathname, children]);

  // Update current page's element when children change (but path stays same)
  useEffect(() => {
    setPageStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.path === location.pathname) {
        return [...prev.slice(0, -1), { ...last, element: children }];
      }
      return prev;
    });
  }, [children, location.pathname]);

  const canGoBack = pageStack.length > 1;

  const isSwipeDisabled = DISABLE_SWIPE_PAGES.some(page =>
    location.pathname.startsWith(page)
  );

  const getScreenWidth = useCallback(() => {
    return containerRef.current?.clientWidth || window.innerWidth;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isSwipeDisabled || !canGoBack || isAnimating) return;

    const touch = e.touches[0];
    const startedInEdge = touch.clientX < EDGE_WIDTH;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      startedInEdge,
    };
  }, [isSwipeDisabled, canGoBack, isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !touchStartRef.current.startedInEdge || isAnimating) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    if (deltaX > 10 && deltaX > deltaY * 1.5) {
      if (!isSwiping) {
        setIsSwiping(true);
      }
      const maxOffset = getScreenWidth();
      setSwipeOffset(Math.max(0, Math.min(deltaX, maxOffset)));
    }
  }, [isSwiping, isAnimating, getScreenWidth]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !isSwiping) {
      touchStartRef.current = null;
      return;
    }

    const screenWidth = getScreenWidth();
    const swipePercentage = swipeOffset / screenWidth;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = swipeOffset / elapsed;

    const shouldComplete = swipePercentage > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    setIsAnimating(true);

    if (shouldComplete && canGoBack) {
      setSwipeOffset(screenWidth);
      setTimeout(() => {
        navigate(-1);
        setIsSwiping(false);
        setSwipeOffset(0);
        setIsAnimating(false);
      }, 200);
    } else {
      setSwipeOffset(0);
      setTimeout(() => {
        setIsSwiping(false);
        setIsAnimating(false);
      }, 200);
    }

    touchStartRef.current = null;
  }, [isSwiping, swipeOffset, canGoBack, navigate, getScreenWidth]);

  const screenWidth = getScreenWidth();
  const swipeProgress = screenWidth > 0 ? swipeOffset / screenWidth : 0;

  // Render all pages in stack
  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {pageStack.map((page, index) => {
        const isCurrentPage = index === pageStack.length - 1;
        const isPreviousPage = index === pageStack.length - 2;
        const isVisible = isCurrentPage || (isPreviousPage && (isSwiping || isAnimating));

        if (!isVisible && index < pageStack.length - 2) {
          // Don't render pages that are too far back
          return null;
        }

        let transform = 'translateX(0)';
        let opacity = 1;
        let zIndex = index;
        let boxShadow = 'none';

        if (isCurrentPage) {
          zIndex = 10;
          if (isSwiping || isAnimating) {
            transform = `translateX(${swipeOffset}px)`;
            boxShadow = '-5px 0 25px rgba(0,0,0,0.2)';
          }
        } else if (isPreviousPage) {
          zIndex = 5;
          // Previous page starts at -30% and moves to 0 as swipe progresses
          const offset = -30 + (swipeProgress * 30);
          transform = `translateX(${offset}%)`;
          opacity = 0.85 + (swipeProgress * 0.15);
        } else {
          // Hidden pages
          transform = 'translateX(-30%)';
          opacity = 0;
        }

        const pageStyle: React.CSSProperties = {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#f5f5f5',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          transform,
          opacity,
          zIndex,
          boxShadow,
          transition: isAnimating ? 'transform 0.2s ease-out, opacity 0.2s ease-out' : 'none',
          pointerEvents: isCurrentPage ? 'auto' : 'none',
        };

        return (
          <div key={page.key} style={pageStyle}>
            {page.element}
          </div>
        );
      })}

      {/* Dimming overlay on previous page during swipe */}
      {(isSwiping || isAnimating) && pageStack.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'black',
            opacity: 0.15 * (1 - swipeProgress),
            zIndex: 6,
            pointerEvents: 'none',
            transition: isAnimating ? 'opacity 0.2s ease-out' : 'none',
          }}
        />
      )}

      {/* Edge swipe indicator */}
      {canGoBack && !isSwipeDisabled && !isSwiping && !isAnimating && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: '4px',
            height: '60px',
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '0 4px 4px 0',
            pointerEvents: 'none',
            zIndex: 1000,
            opacity: 0.5,
          }}
        />
      )}
    </div>
  );
}

export default SwipeableRoutes;
