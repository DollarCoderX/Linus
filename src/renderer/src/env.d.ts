/// <reference types="vite/client" />

import type { LinusBridge } from '../../shared/linus';

declare global {
  interface Window {
    linus: LinusBridge;
  }
}
