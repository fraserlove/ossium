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

    protected get uniformData(): Float32Array {
        // Aligned to 16 bytes (20 floats = 80 bytes)
        // https://www.w3.org/TR/WGSL/#alignment-and-size
        const uniformData = new Float32Array(20);
        uniformData.set(this.camera.view, 0);
        uniformData.set(this.gui.settings, 16);
        return uniformData;
    }
}