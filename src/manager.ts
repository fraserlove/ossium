import { Context } from './context';
import { RendererMPR } from './mpr';
import { Renderer } from './renderer';
import { RendererSVR } from './svr';
import { GlobalGUI } from './gui';

export class RendererManager {

    private renderers: Map<number, Renderer>;
    private context: Context;
    private settings: GlobalGUI;

    constructor(context) {
        this.context = context;
        this.renderers = new Map<number, Renderer>();
        this.settings = new GlobalGUI(this);

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
        else this.renderers.set(renderer.id, renderer);
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
        console.log('MANAGER: Resetting renderer ' + rendererID + '...');
        const renderer = this.renderers.get(rendererID);
        if (renderer) {
            renderer.reset();
        }
        console.log('MANAGER: Reset Renderer.');
    }

    public reloadAllRenderers(): void {
        console.log('MANAGER: Resetting all renderers...');
        for (const renderer of this.renderers.values()) {
            renderer.reset();
        }
    }
}