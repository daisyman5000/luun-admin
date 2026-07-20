declare module "react-globe.gl" {
  import type { ComponentType, Ref } from "react";

  type GlobeProps = Record<string, unknown> & {
    ref?: Ref<unknown>;
  };

  const Globe: ComponentType<GlobeProps>;
  export default Globe;
}
