import { Context } from "./context";
import { RendererMPR } from "./mpr";
import { Renderer } from "./renderer";
import { RendererSVR } from "./svr";
import { GlobalSettings } from "./gui";

export class RendererManager {

    private renderers: Map<number, Renderer>;
    private context: Context;
    private settings: GlobalSettings;

    constructor(context) {
        this.context = context;
        this.renderers = new Map<number, Renderer>();
        this.settings = new GlobalSettings(this);

        window.onresize = () => {
            if (this.context.getDevice() != undefined) { this.resize(); }
        }
    }

    public getContext(): Context { return this.context; }

    public render(): void {
        for (const [key, renderer] of this.renderers.entries()) { renderer.render(); }
    }

    public addMPR(renderID?: number): void { this.addRenderer(new RendererMPR(this, renderID)); }

    public addSVR(renderID?: number): void { this.addRenderer(new RendererSVR(this, renderID)); }

    private async addRenderer(renderer: Renderer, renderID?: number): Promise<void> {
        if (renderID != undefined) this.renderers.set(renderID, renderer);
        else this.renderers.set(renderer.getID(), renderer);
        this.resize();
        await renderer.start();
    }

    public destroyRenderer(rendererID: number): void {
        this.context.removeWindow(rendererID);
        this.renderers.delete(rendererID);
        this.resize();
    }

    public resize(): void {
        for (const [key, renderer] of this.renderers.entries()) {
            renderer.resize([window.innerWidth / this.renderers.size, window.innerHeight]);
        }
    }

    public reloadRenderer(rendererID: number) {
        console.log('MANAGER: Reloading renderer ' + rendererID + '...');
        if (this.renderers.get(rendererID) instanceof RendererMPR) {
            this.destroyRenderer(rendererID); this.addMPR(rendererID);
        }
        else if (this.renderers.get(rendererID) instanceof RendererSVR) {
            this.destroyRenderer(rendererID); this.addSVR(rendererID);   
        }
        console.log('MANAGER: Reloaded Renderer.')
    }

    public reloadAllRenderers(): void {
        console.log('MANAGER: Reloading all renderers...');
        const rendererIds = Array.from(this.renderers.keys());
        for (const id of rendererIds) {
            this.reloadRenderer(id);
        }
    }
}