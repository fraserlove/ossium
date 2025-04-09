import { Renderer } from './renderer';
import { SVRGUI } from './gui';
import svr from '../shaders/svr.wgsl';
import { RendererManager } from './manager';

export class RendererSVR extends Renderer {

    private transferFunctionTexture: GPUTexture;

    constructor(manager: RendererManager, renderID?: number) {
        super(manager, renderID);
        this.gui = new SVRGUI(this.renderID, manager);
    }

    protected getShaderCode(): string {
        return svr;
    }

    protected initPipelineLayouts(): void {
        this.bindGroupLayoutEntries.push({
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: 'unfilterable-float', viewDimension: '1d' }
        });
        super.initPipelineLayouts();
    }

    protected initResources(): void {
        super.initResources();

        // Calculate dimensions for transfer function texture
        const tf = this.context.getTransferFunction();
        
        this.transferFunctionTexture = this.context.getDevice().createTexture({
            size: [tf.size],
            format: 'rgba32float',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '1d'
        });

        // Calculate bytesPerRow (4 bytes per component * 4 components * size[0])
        const bytesPerRow = tf.size * 4 * 4;
        
        const imageDataLayout = {
            offset: 0,
            bytesPerRow: bytesPerRow,
            rowsPerImage: 1
        };

        this.context.getQueue().writeTexture(
            { texture: this.transferFunctionTexture },
            tf.data,
            imageDataLayout,
            [tf.size]
        );
    }

    protected initBindGroup(): void {
        this.bindGroupEntries = [];
        this.bindGroupEntries.push({ binding: 0, resource: { buffer: this.uniformBuffer } });
        this.bindGroupEntries.push({ binding: 1, resource: this.volumeTexture.createView() });
        this.bindGroupEntries.push({ binding: 2, resource: this.sampler });
        this.bindGroupEntries.push({ binding: 3, resource: this.transferFunctionTexture.createView() });

        this.bindGroup = this.context.getDevice().createBindGroup({
            layout: this.bindGroupLayout,
            entries: this.bindGroupEntries
        });
    }

    protected getUniformData(): Float32Array {
        // Ensure 16-byte alignment (32 floats = 128 bytes) - https://www.w3.org/TR/WGSL/#alignment-and-size
        const uniformData = new Float32Array(32);
        
        // Set view matrix (16 floats)
        uniformData.set(this.camera.getViewMatrix(), 0);
        
        // Set light position (vec3 + padding)
        uniformData.set(this.camera.getLightDir(), 16);
        
        // Set bounding box (vec3 + padding)
        uniformData.set(this.context.getVolume().boundingBox, 20);
        
        // Set lighting attributes
        const settings = (this.gui as SVRGUI).getSettings();
        uniformData.set(settings, 24);
        
        // Set transfer function size
        uniformData[30] = this.context.getTransferFunction().size;
        
        return uniformData;
    }
}