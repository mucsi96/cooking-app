import { ImageGenerationRequest, ImageGenerationResponse } from './types';

// 10x10 single-color PNGs. Source: https://png-pixel.com
export const IMAGES = {
  yellow: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8/5/hPwMRgHFUIX0VAgAYyB3tBFoR2wAAAABJRU5ErkJggg==',
  red: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8AARIQB46hC+ioEAGX8E/cKr6qsAAAAAElFTkSuQmCC',
  blue: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPj/n4EIwDiqkL4KAVIQE/f1/NxEAAAAAElFTkSuQmCC',
  green: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mNk+A+ERADGUYX0VQgAXAYT9xTSUocAAAAASUVORK5CYII=',
};

const COLOR_CYCLE = [IMAGES.yellow, IMAGES.red, IMAGES.blue, IMAGES.green];

export class ImageGenerationHandler {
  private callCount = 0;

  reset(): void {
    this.callCount = 0;
  }

  generateImages(request: ImageGenerationRequest): ImageGenerationResponse {
    const { prompt, n = 1 } = request;

    console.log('Received image generation request with prompt:', prompt, 'n:', n);

    // Cycle through colors so parallel candidate generations differ
    const images = Array.from({ length: n }, () => {
      const image = COLOR_CYCLE[this.callCount % COLOR_CYCLE.length];
      this.callCount += 1;
      return image;
    });

    return {
      created: Date.now(),
      data: images.map((b64_json) => ({
        b64_json,
        revised_prompt: prompt,
        url: null,
      })),
    };
  }
}
