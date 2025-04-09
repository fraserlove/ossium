import { Renderer } from './renderer';
import { MPRGUI } from './gui';
import mpr from '../shaders/mpr.wgsl';
import { RendererManager } from './manager';

export class RendererMPR extends Renderer {
    constructor(manager: RendererManager, renderID?: number) {
        super(manager, renderID);
        this.gui = new MPRGUI(this.renderID, manager);
    }

    protected getShaderCode(): string {
        return mpr;
    }

    protected getUniformData(): Float32Array {
        // Create uniform buffer with 16-byte alignment (80 bytes) - https://www.w3.org/TR/WGSL/#alignment-and-size
        const uniformData = new Float32Array(20);
        
        // Set view matrix (16 floats)
        uniformData.set(this.camera.getViewMatrix(), 0);
        
        // Add window attributes
        const settings = (this.gui as MPRGUI).getSettings();
        uniformData.set(settings, 16);
        
        return uniformData;
    }
}