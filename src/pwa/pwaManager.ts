/* PWA Registration and Installation Manager */

export interface PwaState {
  isInstalled: boolean;
  canInstallPrompt: boolean;
  isIOS: boolean;
}

type PwaListener = (state: PwaState) => void;

let deferredPrompt: any = null;
const listeners = new Set<PwaListener>();

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getPwaState(): PwaState {
  const isInstalled = isRunningStandalone();
  const isIOS = isIOSDevice();
  const canInstallPrompt = !isInstalled && !!deferredPrompt;
  return { isInstalled, canInstallPrompt, isIOS };
}

function notifyListeners() {
  const state = getPwaState();
  listeners.forEach((listener) => listener(state));
}

export function subscribePwaState(listener: PwaListener): () => void {
  listeners.add(listener);
  listener(getPwaState());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Register the Service Worker in production/local environments
 */
export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined') return;

  // Listen for beforeinstallprompt event on Chrome/Edge/Android
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notifyListeners();
  });

  // Listen for appinstalled event
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyListeners();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Use relative path so it functions in both local root and gh-pages /ticktick-pro/ subpath
      const swUrl = './sw.js';
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          // Check for worker updates immediately on page load
          reg.update().catch(() => {});

          const handleInstalling = (worker: ServiceWorker) => {
            worker.onstatechange = () => {
              if (worker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // Prompt the waiting worker to activate immediately
                  worker.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  console.log('[PWA] Content cached for offline use.');
                }
              }
            };
          };

          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          reg.onupdatefound = () => {
            if (reg.installing) {
              handleInstalling(reg.installing);
            }
          };
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });

      // Reload once the new service worker takes control so users seamlessly see the latest deployment
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

/**
 * Trigger native install prompt or return guidance requirement
 */
export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'manual_ios' | 'unavailable'> {
  if (isRunningStandalone()) {
    return 'accepted';
  }

  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        deferredPrompt = null;
        notifyListeners();
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.error('[PWA] Prompt error:', err);
      return 'unavailable';
    }
  }

  if (isIOSDevice()) {
    return 'manual_ios';
  }

  return 'unavailable';
}
