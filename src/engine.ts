import { Volume } from './volume';
import { TransferFunction } from './transfer_function';
import { Renderer } from './renderer';
import { RendererMPR } from './mpr';
import { RendererSVR } from './svr';
import { GlobalGUI } from './gui';

export class Engine {
    private volume: Volume;
    private transferFunction: TransferFunction;
    private volumeIDs: string[] = [];
    private transferFunctionIDs: string[] = [];
    private adapter: GPUAdapter;
    private device: GPUDevice;
    private queue: GPUQueue;

    private containers = new Map<number, HTMLDivElement>();
    private windows = new Map<number, HTMLCanvasElement>();
    private contexts = new Map<number, GPUCanvasContext>();
    
    private renderers = new Map<number, Renderer>();
    private settings: GlobalGUI;

    constructor() {
        this.volume = new Volume();
        this.transferFunction = new TransferFunction();
        this.settings = new GlobalGUI(this);

        // Add window resize handler
        window.onresize = () => {
            if (this.device != undefined) { this.resize(); }
        }
    }

    public getVolume(): Volume { return this.volume; }
    public getTransferFunction(): TransferFunction { return this.transferFunction; }
    public getVolumeIDs(): string[] { return this.volumeIDs; }
    public getTransferFunctionIDs(): string[] { return this.transferFunctionIDs; }
    public getDevice(): GPUDevice { return this.device; }
    public getQueue(): GPUQueue { return this.queue; }
    public getContainer(id: number): HTMLDivElement { return this.containers.get(id); }
    public getWindow(id: number): HTMLCanvasElement { return this.windows.get(id); }
    public getGPUContext(id: number): GPUCanvasContext { return this.contexts.get(id); }
    public displayFormat(): GPUTextureFormat { return navigator.gpu.getPreferredCanvasFormat(); }

    /**
     * Loads a volume from files
     * @param files Files containing volume data
     */
    public async loadVolume(files: File[], folderName: string): Promise<void> {
        try {
            const volume = new Volume(folderName);
            await volume.load(files);
            this.volume = volume;
            
            if (!this.volumeIDs.includes(volume.name)) {
                this.volumeIDs.push(volume.name);
            }
            
            console.log(`Loaded Volume ${this.volume.name}`);
        } catch (error) {
            console.error('Failed to load volume:', error);
        }
    }

    /**
     * Loads a transfer function from a file
     * @param file File containing transfer function data
     */
    public async loadTransferFunction(file: File): Promise<void> {
        try {
            const tf = new TransferFunction(file.name);
            await tf.load(file);
            this.transferFunction = tf;
            
            if (!this.transferFunctionIDs.includes(tf.name)) {
                this.transferFunctionIDs.push(tf.name);
            }
            
            console.log(`Loaded Transfer Function ${this.transferFunction.name}`);
        } catch (error) {
            console.error('Failed to load transfer function:', error);
        }
    }

    /**
     * Creates a new window for rendering
     * @param renderID Unique ID for the renderer
     * @returns The created canvas element
     */
    public newWindow(renderID: number): HTMLCanvasElement {
        const container = document.createElement('div');
        container.id = 'container';
        this.containers.set(renderID, container);

        const canvas = document.createElement('canvas');
        this.windows.set(renderID, canvas);

        const context = canvas.getContext('webgpu');
        if (!context) {
            throw new Error('Failed to get WebGPU context');
        }
        
        context.configure({ 
            device: this.device, 
            format: this.displayFormat(), 
            alphaMode: 'premultiplied' 
        });
        
        this.contexts.set(renderID, context);
            
        container.appendChild(canvas);
        document.body.appendChild(container);
        return canvas;
    }

    /**
     * Removes a window and its associated resources
     * @param id ID of the window to remove
     */
    public removeWindow(id: number): void {
        const container = this.containers.get(id);
        if (container) {
            container.remove();
            this.containers.delete(id);
            this.windows.delete(id);
            this.contexts.delete(id);
        }
    }

    /**
     * Resizes a window to the specified dimensions
     * @param id ID of the window to resize
     * @param size New dimensions [width, height]
     */
    public resizeWindow(id: number, size: number[]): void {
        const window = this.windows.get(id);
        if (window) {
            window.width = size[0];
            window.height = size[1];
        }
    }

    /**
     * Initialises WebGPU
     * @returns True if initialisation was successful, false otherwise
     */
    public async initWebGPU(): Promise<boolean> {
        try {
            this.adapter = await navigator.gpu.requestAdapter();
            if (!this.adapter) {
                throw new Error('No GPU adapter found');
            }
            
            // Check adapter limits and request higher buffer size limit
            const adapterLimits = this.adapter.limits;
            const requiredLimits = {
                maxStorageBufferBindingSize: adapterLimits.maxStorageBufferBindingSize,
                maxBufferSize: adapterLimits.maxStorageBufferBindingSize
            };
            
            this.device = await this.adapter.requestDevice({
                requiredLimits: requiredLimits
            });
            
            this.queue = this.device.queue;
            console.log('Initialised WebGPU.');
            return true;
        }
        catch(error) {
            console.error(error);
            console.log('WebGPU Not Supported.');
            return false;
        }
    }

    // Add renderer management methods
    public render(): void {
        for (const renderer of this.renderers.values()) {
            renderer.render();
        }
    }

    public addMPR(renderID?: number): void {
        this.addRenderer(new RendererMPR(this, renderID));
    }

    public addSVR(renderID?: number): void {
        this.addRenderer(new RendererSVR(this, renderID));
    }

    private async addRenderer(renderer: Renderer, renderID?: number): Promise<void> {
        if (renderID != undefined) {
            this.renderers.set(renderID, renderer);
        } else {
            this.renderers.set(renderer.id, renderer);
        }
        this.resize();
        await renderer.start();
    }

    public destroyRenderer(rendererID: number): void {
        this.removeWindow(rendererID);
        this.renderers.delete(rendererID);
        this.resize();
    }

    public resize(): void {
        for (const renderer of this.renderers.values()) {
            renderer.resize([window.innerWidth / this.renderers.size, window.innerHeight]);
        }
    }

    public reloadRenderer(rendererID: number): void {
        console.log('Resetting renderer ' + rendererID + '...');
        const renderer = this.renderers.get(rendererID);
        if (renderer) {
            renderer.reset();
        }
        console.log('Reset Renderer.');
    }

    public reloadAllRenderers(): void {
        console.log('Resetting all renderers...');
        for (const renderer of this.renderers.values()) {
            renderer.reset();
        }
    }
}