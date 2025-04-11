import { Renderer } from './renderer';
import { MPRGUI } from './gui';
import mpr from '../shaders/mpr.wgsl';
import { Engine } from './engine';

export class RendererMPR extends Renderer {
    constructor(engine: Engine, renderID?: number) {
        super(engine, renderID);
        this.gui = new MPRGUI(this.renderID, engine);
        this._shaderCode = mpr;
    }

    protected getUniformData(): Float32Array {
        // Create uniform buffer with 16-byte alignment (80 bytes) - https://www.w3.org/TR/WGSL/#alignment-and-size
        const uniformData = new Float32Array(20);
        
        // Set view matrix (16 floats)
        uniformData.set(this.camera.view, 0);
        
        // Add window attributes
        const settings = (this.gui as MPRGUI).getSettings();
        uniformData.set(settings, 16);
        
        return uniformData;
    }
}