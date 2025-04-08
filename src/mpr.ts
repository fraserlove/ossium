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
        // Create uniform buffer with 16-byte alignment (80 bytes)
        const uniformData = new Float32Array(20);
        
        // Copy view matrix (16 elements)
        uniformData.set(this.camera.getViewMatrix(), 0);
        
        // Add window settings and volume metadata
        const [width, level] = (this.gui as MPRGUI).getSettings();
        uniformData[16] = width;
        uniformData[17] = level;
        
        return uniformData;
    }
}