declare module "three" {
  export class Color {
    constructor(color: string);
  }

  export class MeshPhongMaterial {
    color: Color;
    shininess: number;
    bumpScale: number;
  }
}
