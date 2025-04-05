import { Camera } from "./camera";

export class Controller {
    private window: HTMLCanvasElement;
    private camera: Camera;
    private leftDown: boolean;
    private updateLightSource: boolean;
    private rightDown: boolean;
    private initPos: [number, number];

    private scaleFactor: number = 1000;
    private rotationFactor: number = 100;
    private cineFactor: number = 10;
    private lightFactor: number = 400;

    constructor(window: HTMLCanvasElement, camera: Camera) {
        this.window = window;
        this.camera = camera;
        this.leftDown = false;
        this.updateLightSource = false;
        this.initPos = [0, 0];
        this.initMouse();
        this.initKeyboard();
    }

    private initMouse(): void {
        // Mouse zoom
        this.window.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault(); // Disables backwards page-navigation on horizontal scroll
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) this.camera.updateScale(e.deltaY / this.scaleFactor);
            else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) this.camera.updateCine(e.deltaX / this.cineFactor);
        }, { passive: false });

        // Mouse drag
        this.window.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button == 0) this.leftDown = true;
            else if (e.button == 2) this.rightDown = true;
            this.initPos = [e.pageX, e.pageY];
        }, false);
        this.window.addEventListener('mouseup', (e: MouseEvent) => {
            if (e.button == 0) this.leftDown = false; 
            else if (e.button == 2) this.rightDown = false;
        }, false);
        this.window.addEventListener('mousemove', (e: MouseEvent) => {
            const dx = e.pageX - this.initPos[0];
            const dy = e.pageY - this.initPos[1];
            if (this.updateLightSource && this.leftDown) this.camera.updateLighting(dx / this.lightFactor, dy / this.lightFactor);
            else if (!this.updateLightSource && this.leftDown) this.camera.updateRotation(-dx / this.rotationFactor, dy / this.rotationFactor);
            else if (this.rightDown) this.camera.updatePan(dx, dy);
            this.initPos = [e.pageX, e.pageY];
        }, false);

        // Disable right-click menu
        this.window.oncontextmenu = function (e) {
            e.preventDefault();
        };
    }

    private initKeyboard(): void {
        document.addEventListener('keydown', (e : KeyboardEvent) => {
            switch(e.key) {
                case 'Shift': this.updateLightSource = true; break;
            }
        }, false);
        document.addEventListener('keyup', (e : KeyboardEvent) => {
            switch(e.key) {
                case 'Shift': this.updateLightSource = false; break;
            }
        }, false);
    }
}