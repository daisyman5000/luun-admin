declare module "three" {
  export const SRGBColorSpace: string;

  export class Color {
    constructor(color: string);
  }

  export class Texture {
    colorSpace: string;
  }

  export class TextureLoader {
    load(
      url: string,
      onLoad?: (texture: Texture) => void,
      onProgress?: unknown,
      onError?: () => void
    ): Texture;
  }

  export class MeshPhongMaterial {
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
    map?: Texture;
    needsUpdate: boolean;
    shininess: number;

    constructor(parameters?: {
      color?: string;
      emissive?: string;
      emissiveIntensity?: number;
      shininess?: number;
    });
  }
}
