import { GUI } from 'dat.gui';
import { Context } from './context';

export class Settings {
    protected gui: GUI;
    protected context: Context;

    constructor(renderID: number, context: Context) {
        this.context = context;

        //let container = document.createElement('div');
        //container.id = 'gui_container';
        //document.body.appendChild(container);

        //this.gui = new GUI();
        this.gui = new GUI({ autoPlace: false });
        this.gui.domElement.id = 'gui';
        this.context.getContainer(renderID).appendChild(this.gui.domElement);
    }
}

export class SettingsMPR extends Settings {

    private wWidth: number = 1000.0/65535.0;
    private wLevel: number = 0.498;

    private slabCentre: number;
    private noSamples: number;

    constructor(renderID: number, context: Context) {
        super(renderID, context);

        let maxDepth = this.context.getVolume().getDepth();
        this.slabCentre = maxDepth / 2;
        this.noSamples = maxDepth;

        const folder = this.gui.addFolder('MPR Settings');
        folder.add(this, 'noSamples', 0, maxDepth);
        folder.add(this, 'slabCentre', 0, maxDepth);
        folder.add(this, 'wWidth', 0, 0.05);
        folder.add(this, 'wLevel', 0.48, 0.52, 0.0001);
        folder.open();
    }

    public getWWidthLevel(): Float32Array { return new Float32Array([this.wWidth, this.wLevel]); }
    public getSampleInfo(): Float32Array { return new Float32Array([this.slabCentre, this.noSamples]); } 
}

export class SettingsSVR extends Settings {

    constructor(renderID: number, context: Context) {
        super(renderID, context);

        const folder = this.gui.addFolder('SVR Settings');
        folder.open();
    }
}