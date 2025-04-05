import { Renderer } from './renderer';
import { SettingsMPR } from './gui';
import mpr from '../shaders/mpr.wgsl';
import { RendererManager } from './manager';

export class RendererMPR extends Renderer {

    constructor(manager: RendererManager, renderID?: number) {
        super(manager, renderID);
        this.shaderType = mpr;
        this.settings = new SettingsMPR(this.renderID, manager);
    }

    protected getUniformData(): Float32Array {
        // Ensure 16-byte alignment (20 floats = 80 bytes)
        const uniformData = new Float32Array(20);
        
        // Set view matrix (16 elements)
        uniformData.set(this.camera.getViewMatrix(), 0);
        
        // Set window width/level and bits per voxel
        const settings = (this.settings as SettingsMPR).getSettings();
        uniformData[16] = settings[0];  // width
        uniformData[17] = settings[1];  // level
        uniformData[18] = this.context.getVolume().bitsPerVoxel;
        
        return uniformData;
    }
}