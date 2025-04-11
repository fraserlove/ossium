import { Renderer } from './renderer';
import { SVRGUI } from './gui';
import svr from '../shaders/svr.wgsl';
import { Engine } from './engine';

export class RendererSVR extends Renderer {

    private transferFunctionTexture: GPUTexture;

    constructor(engine: Engine, renderID?: number) {
        super(engine, renderID);
        this.gui = new SVRGUI(this.renderID, engine);
        this._shaderCode = svr;
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
        const tf = this.engine.transferFunction;
        
        this.transferFunctionTexture = this.engine.device.createTexture({
            size: tf.size,
            format: 'rgba32float',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '1d'
        });

        // Calculate bytesPerRow (4 bytes per component * 4 components * size[0])
        const bytesPerRow = tf.size[0] * 4 * 4;
        
        const imageDataLayout = {
            offset: 0,
            bytesPerRow: bytesPerRow,
            rowsPerImage: 1
        };

        this.engine.queue.writeTexture(
            { texture: this.transferFunctionTexture },
            tf.data,
            imageDataLayout,
            tf.size
        );
    }

    protected initBindGroup(): void {
        this.bindGroupEntries = [];
        this.bindGroupEntries.push({ binding: 0, resource: { buffer: this.uniformBuffer } });
        this.bindGroupEntries.push({ binding: 1, resource: this.volumeTexture.createView() });
        this.bindGroupEntries.push({ binding: 2, resource: this.sampler });
        this.bindGroupEntries.push({ binding: 3, resource: this.transferFunctionTexture.createView() });

        this.bindGroup = this.engine.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: this.bindGroupEntries
        });
    }

    protected get uniformData(): Float32Array {
        // Aligned to 16 bytes (28 floats = 112 bytes)
        // https://www.w3.org/TR/WGSL/#alignment-and-size
        const uniformData = new Float32Array(28);
        uniformData.set(this.camera.view, 0);
        uniformData.set(this.camera.lightDir, 16);
        uniformData.set(this.gui.settings, 20);
        uniformData.set(this.engine.transferFunction.size, 26);
        return uniformData;
    }
}