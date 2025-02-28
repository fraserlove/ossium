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

        this.transferFunctionTexture = this.context.getDevice().createTexture({
            size: this.context.getTransferFunction().size,
            format: this.context.getTransferFunction().colourFormat,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '2d'
        });

        const imageDataLayout = {
            offset: 0,
            bytesPerRow: this.context.getTransferFunction().size[0] * 4 * 4,
            rowsPerImage: this.context.getTransferFunction().size[1]
        };

        this.context.getQueue().writeTexture({ texture: this.transferFunctionTexture }, this.context.getTransferFunction().data, imageDataLayout, this.context.getTransferFunction().size);
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
        let paddingLength = 2; // length of padding (bytelength of padding is this value * 4)
        let uniformData = new Float32Array(this.camera.getViewMatrix().length + 
                                                    this.camera.getLightDir().length + 
                                                    this.context.getVolume().boundingBox.length + 
                                                    (this.settings as SettingsSVR).getSettings().length + 
                                                    2 + paddingLength);
                                                    
        // extra zeros are required padding, see - https://www.w3.org/TR/WGSL/#alignment-and-size
        uniformData.set([...this.camera.getViewMatrix(), 
                                ...this.camera.getLightDir(), 0,
                                ...this.context.getVolume().boundingBox, 0, 
                                ...(this.settings as SettingsSVR).getSettings(), 
                                this.context.getTransferFunction().size[0],
                                this.context.getVolume().bitsPerVoxel]);
        return uniformData;
    }
}