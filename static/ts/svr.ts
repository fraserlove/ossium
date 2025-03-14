import { Renderer } from './renderer';
import { SettingsSVR } from './settings';
import svr from '../shaders/svr.wgsl';
import { RendererManager } from './manager';

export class RendererSVR extends Renderer {

    private transferFunctionTexture: GPUTexture;

    constructor(manager: RendererManager, renderID?: number) {
        super(manager, renderID);
        this.shaderType = svr;
        this.settings = new SettingsSVR(this.renderID, manager);
    }

    protected initPipelineLayouts(): void {
        this.bindGroupLayoutEntries.push({
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: 'unfilterable-float', viewDimension: '2d' }
        });
        super.initPipelineLayouts();
    }

    protected initResources(): void {
        super.initResources();

        // Calculate the correct dimensions for the transfer function texture
        const transferWidth = this.context.getDevice().limits.maxTextureDimension1D;
        const transferHeight = Math.ceil(this.context.getTransferFunction().n_colours / transferWidth);
        
        this.transferFunctionTexture = this.context.getDevice().createTexture({
            size: [transferWidth, transferHeight],
            format: 'rgba32float',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '2d'
        });

        const imageDataLayout = {
            offset: 0,
            bytesPerRow: transferWidth * 16,
            rowsPerImage: transferHeight
        };

        // The actual size for the write operation should match the data
        const writeSize = {
            width: this.context.getTransferFunction().n_colours,
            height: 1,
            depthOrArrayLayers: 1
        };

        this.context.getQueue().writeTexture(
            { texture: this.transferFunctionTexture },
            this.context.getTransferFunction().data,
            imageDataLayout,
            writeSize
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
        // extra zeros are required padding, see - https://www.w3.org/TR/WGSL/#alignment-and-size
        // Ensure 16-byte alignment (160 bytes = 40 floats)
        const uniformData = new Float32Array(40);
        
        // Set view matrix (16 floats)
        uniformData.set(this.camera.getViewMatrix(), 0);
        
        // Set light position (vec3 + padding)
        uniformData.set(this.camera.getLightDir(), 16);
        
        // Set bounding box (vec3 + padding)
        uniformData.set(this.context.getVolume().boundingBox, 20);
        
        // Set light color and brightness
        const settings = (this.settings as SettingsSVR).getSettings();
        uniformData.set(settings.slice(0, 4), 24);  // lightColor (vec3) + brightness
        
        // Set slab matrix (mat3x2 + padding)
        uniformData.set(settings.slice(4, 10), 28);  // slab matrix values
        
        // Set remaining values
        uniformData[34] = settings[10];                           // shininess
        uniformData[35] = this.context.getTransferFunction().size[0];  // transferWidth
        uniformData[36] = this.context.getVolume().bitsPerVoxel;      // bitsPerVoxel
        // indices 37-39 are padding
        
        return uniformData;
    }
}