
declare module "js-dos" {
  export interface DosPlayerConfig {
    wdosboxUrl: string;
  }

  export interface DosPlayer {
    mount(path: string): Promise<void>;
    run(executableOrArgs: string, args?: string[]): Promise<void>;
    exit(): void;
  }

  export interface DosPlayerFactoryType {
    (canvas: HTMLCanvasElement, config: DosPlayerConfig): Promise<DosPlayer>;
  }

  // v8 exposes named export; keep default for compatibility
  export const Dos: DosPlayerFactoryType;
  const _default: DosPlayerFactoryType;
  export default _default;
}

declare module "js-dos/dist/js-dos" {
  export * from "js-dos";
  import _default from "js-dos";
  export default _default;
}
