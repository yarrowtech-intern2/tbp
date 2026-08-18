import { useEnvironment, useGLTF, useTexture } from '@react-three/drei';
import { Cache } from 'three';

// Lets three.js's FileLoader (which GLTFLoader/TextureLoader/RGBELoader all
// build on) share one cached response per URL, so the warm-up fetches below
// and the real drei hooks that run once the room stage actually mounts
// don't both pay for the network transfer.
Cache.enabled = true;

const MODEL_URL = '/models/tbp-hero-model.glb';
const CLOUD_URLS = ['/images/cloud-2.png', '/images/cloud-3.png', '/images/cloud-1.png'];
// Mirrors drei's `preset="city"` mapping (@react-three/drei/helpers/environment-assets) —
// duplicated only so this warm-up fetch targets the exact same CDN file.
const ENVIRONMENT_HDR_URL = 'https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/potsdamer_platz_1k.hdr';

const fetchWarmCache = async (url: string) => {
  try {
    await fetch(url, { cache: 'force-cache' });
  } catch {
    // Non-blocking: the real loader will retry through its own request.
  }
};

export const preloadRoomModelStage = async () => {
  // drei's `.preload()` helpers kick off the actual GLTFLoader/TextureLoader/
  // RGBELoader parse in the background, but they always return `undefined`
  // (suspend-react's `preload` is fire-and-forget by design), so there's
  // nothing here to await. The fetches below are what this promise actually
  // waits on: pulling the ~4MB Draco-compressed model and the environment
  // HDR fully into the HTTP cache before the loading curtain closes, so
  // that multi-second network transfer never has to happen while the user
  // is mid-scroll into the cinematic hero.
  useGLTF.preload(MODEL_URL);
  useTexture.preload(CLOUD_URLS);
  useEnvironment.preload({ preset: 'city' });

  await Promise.all([
    fetchWarmCache(MODEL_URL),
    fetchWarmCache(ENVIRONMENT_HDR_URL),
  ]);
};
