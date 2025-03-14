import { Renderer } from './renderer';
import { SettingsMPR } from './settings';
import mpr from '../shaders/mpr.wgsl';
import { RendererManager } from './manager';

export class RendererMPR extends Renderer {

    constructor(manager: RendererManager, renderID?: number) {
        super(manager, renderID);
        this.shaderType = mpr;
        this.settings = new SettingsMPR(this.renderID, manager);
    }

    protected getUniformData(): Float32Array {
        // Ensure 16-byte alignment
        const uniformData = new Float32Array(28);
        
        // Set view matrix (16 elements)
        uniformData.set(this.camera.getViewMatrix(), 0);
        
        // Set settings (slab matrix and other values)
        const settings = (this.settings as SettingsMPR).getSettings();
        uniformData.set(settings, 16);
        
        // Set bitsPerVoxel
        uniformData[24] = this.context.getVolume().bitsPerVoxel;
        
        return uniformData;
    }
}