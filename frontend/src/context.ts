import { Volume } from './volume';
import { Renderer } from './renderer';

export class Context {
    private volume: Volume;
    private renderers: Renderer[];

    private adapter: GPUAdapter;
    private device: GPUDevice;
    private queue: GPUQueue;

    private windows: HTMLCanvasElement[];
    private contexts: GPUCanvasContext[];
    private canvasFormat: GPUTextureFormat;

    private width: number;
    private height: number;

    constructor(volume: Volume, width: number, height: number) {
        this.volume = volume;
        this.width = width;
        this.height = height;
        this.windows = [];
        this.contexts = [];
        this.renderers = [];
        this.checkResize();
    }

    public getVolume(): Volume { return this.volume; }
    public getDevice(): GPUDevice { return this.device; }
    public getQueue(): GPUQueue { return this.queue; }
    public getWindow(idx: number): HTMLCanvasElement { return this.windows[idx]; }
    public getWindowContext(idx: number): GPUCanvasContext { return this.contexts[idx]; }
    public windowSize(idx: number): number[] { return [this.windows[idx].width, this.windows[idx].height]; }
    public displayFormat(): GPUTextureFormat { return this.canvasFormat; }

    public addRenderer(renderer: Renderer): number {
        this.renderers.push(renderer);
        let window = document.createElement('canvas');
        document.body.appendChild(window);
        this.windows.push(window);
        for (let i = 0; i < this.windows.length; i++) { 
            this.windows[i].width = this.width / this.windows.length;
            this.windows[i].height = this.height;
        }
        return this.windows.length - 1;
    }

    private checkResize(): void {
        window.onresize = () => {
            if (this.getDevice() != undefined) { this.resize(window.innerWidth, window.innerHeight); }
        }
    }

    public resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        for (let i = 0; i < this.renderers.length; i++) { 
            this.windows[i].width = this.width / this.windows.length; 
            this.windows[i].height = this.height;
            this.renderers[i].resize();
        }
    }

    public async initWebGPU(): Promise<boolean> {
        console.log('CONTEXT: Initialising WebGPU...');
        try {
            this.adapter = await navigator.gpu.requestAdapter();
            this.device = await this.adapter.requestDevice();
            this.queue = this.device.queue;
            this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();

            for (let i = 0; i < this.windows.length; i++) {
                let context = this.windows[i].getContext('webgpu');
                context.configure({
                    device: this.device,
                    format: this.canvasFormat,
                    alphaMode: 'premultiplied'
                });
                this.contexts.push(context);
            }
        }
        catch(error) {
            console.error(error);
            console.log('CONTEXT: WebGPU Not Supported.');
            return false;
        }
        console.log('CONTEXT: Initialised WebGPU.');
        return true;
    }
}