
declare module "js-dos" {
  export interface DosPlayerConfig {
    wdosboxUrl: string;
  }

  export interface DosPlayer {
    mount(path: string): Promise<void>;
    run(executable: string, args?: string[]): Promise<void>;
    exit(): void;
  }

  export interface DosPlayerFactoryType {
    (canvas: HTMLCanvasElement, config: DosPlayerConfig): Promise<DosPlayer>;
  }

  const Dos: DosPlayerFactoryType;
  export default Dos;
}

declare module "js-dos/dist/js-dos" {
  export * from "js-dos";
  export { default } from "js-dos";
}
