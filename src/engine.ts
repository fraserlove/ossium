import { Volume } from '../types/volume';
import { TransferFunction } from '../types/transfer_function';
import { Renderer } from './renderer';
import { RendererMPR } from './mpr';
import { RendererSVR } from './svr';
import { GlobalGUI } from './gui';

export class Engine {
    private _volume: Volume;
    private _transferFunction: TransferFunction;
    private _volumeIDs: string[] = [];
    private _transferFunctionIDs: string[] = [];
    private _adapter: GPUAdapter;
    private _device: GPUDevice;
    private _queue: GPUQueue;

    private _containers = new Map<number, HTMLDivElement>();
    private _windows = new Map<number, HTMLCanvasElement>();
    private _contexts = new Map<number, GPUCanvasContext>();
    
    private _renderers = new Map<number, Renderer>();
    private _settings: GlobalGUI;

    constructor() {
        this._volume = new Volume();
        this._transferFunction = new TransferFunction();
        this._settings = new GlobalGUI(this);

        // Add window resize handler
        window.onresize = () => this._device && this.resize();
        
        this.initWebGPU();
        
        const run = () => {
            this.render();
            requestAnimationFrame(run);
        }
        requestAnimationFrame(run);
    }

    public get volume(): Volume { return this._volume; }
    public get transferFunction(): TransferFunction { return this._transferFunction; }
    public get volumeIDs(): string[] { return this._volumeIDs; }
    public get transferFunctionIDs(): string[] { return this._transferFunctionIDs; }
    public get device(): GPUDevice { return this._device; }
    public get queue(): GPUQueue { return this._queue; }
    public get displayFormat(): GPUTextureFormat { return navigator.gpu.getPreferredCanvasFormat(); }
    public container(id: number): HTMLDivElement { return this._containers.get(id); }
    public window(id: number): HTMLCanvasElement { return this._windows.get(id); }
    public context(id: number): GPUCanvasContext { return this._contexts.get(id); }

    /**
     * Loads a volume from files
     * @param files Files containing volume data
     */
    public async loadVolume(files: File[], folderName: string): Promise<void> {
        try {
            const volume = new Volume(folderName);
            await volume.load(files);
            this._volume = volume;
            
            if (!this._volumeIDs.includes(volume.name)) {
                this._volumeIDs.push(volume.name);
            }
            
            console.log(`Loaded Volume ${this._volume.name}`);
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
            this._transferFunction = tf;
            
            if (!this._transferFunctionIDs.includes(tf.name)) {
                this._transferFunctionIDs.push(tf.name);
            }
            
            console.log(`Loaded Transfer Function ${this._transferFunction.name}`);
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
        this._containers.set(renderID, container);

        const canvas = document.createElement('canvas');
        this._windows.set(renderID, canvas);

        const context = canvas.getContext('webgpu');
        if (!context) {
            throw new Error('Failed to get WebGPU context');
        }
        
        context.configure({ 
            device: this.device, 
            format: this.displayFormat,
            alphaMode: 'premultiplied' 
        });
        
        this._contexts.set(renderID, context);
            
        container.appendChild(canvas);
        document.body.appendChild(container);
        return canvas;
    }

    /**
     * Removes a window and its associated resources
     * @param id ID of the window to remove
     */
    public removeWindow(id: number): void {
        const container = this._containers.get(id);
        if (container) {
            container.remove();
            this._containers.delete(id);
            this._windows.delete(id);
            this._contexts.delete(id);
        }
    }

    /**
     * Resizes a window to the specified dimensions
     * @param id ID of the window to resize
     * @param size New dimensions [width, height]
     */
    public resizeWindow(id: number, size: number[]): void {
        const window = this._windows.get(id);
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
            this._adapter = await navigator.gpu.requestAdapter();
            if (!this._adapter) {
                throw new Error('No GPU adapter found');
            }
            
            // Check adapter limits and request higher buffer size limit
            const adapterLimits = this._adapter.limits;
            const requiredLimits = {
                maxStorageBufferBindingSize: adapterLimits.maxStorageBufferBindingSize,
                maxBufferSize: adapterLimits.maxStorageBufferBindingSize
            };
            
            this._device = await this._adapter.requestDevice({
                requiredLimits: requiredLimits
            });
            
            this._queue = this._device.queue;
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
        for (const renderer of this._renderers.values()) {
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
            this._renderers.set(renderID, renderer);
        } else {
            this._renderers.set(renderer.id, renderer);
        }
        this.resize();
        await renderer.start();
    }

    public destroyRenderer(rendererID: number): void {
        this.removeWindow(rendererID);
        this._renderers.delete(rendererID);
        this.resize();
    }

    public resize(): void {
        for (const renderer of this._renderers.values()) {
            renderer.resize([window.innerWidth / this._renderers.size, window.innerHeight]);
        }
    }

    public reloadRenderer(rendererID: number): void {
        console.log('Resetting renderer ' + rendererID + '...');
        const renderer = this._renderers.get(rendererID);
        if (renderer) {
            renderer.reset();
        }
        console.log('Reset Renderer.');
    }

    public reloadAllRenderers(): void {
        console.log('Resetting all renderers...');
        for (const renderer of this._renderers.values()) {
            renderer.reset();
        }
    }
}