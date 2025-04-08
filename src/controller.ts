import { Camera } from './camera';

export class Controller {
    private window: HTMLCanvasElement;
    private camera: Camera;
    private leftDown: boolean = false;
    private rightDown: boolean = false;
    private updateLightSource: boolean = false;
    private initPos: [number, number] = [0, 0];

    // Sensitivity parameters
    private readonly scaleFactor: number = 1000;
    private readonly rotationFactor: number = 100;
    private readonly cineFactor: number = 10;
    private readonly lightFactor: number = 400;
    private readonly panFactor: number = 1;

    /**
     * Creates a new controller for camera interaction
     * @param window Canvas element to attach events to
     * @param camera Camera to control
     */
    constructor(window: HTMLCanvasElement, camera: Camera) {
        this.window = window;
        this.camera = camera;
        this.initMouseEvents();
        this.initKeyboardEvents();
    }

    private initMouseEvents(): void {
        // Mouse wheel for zoom and cine
        this.window.addEventListener('wheel', this.handleMouseWheel.bind(this), { passive: false });
        
        // Mouse buttons and movement
        this.window.addEventListener('mousedown', this.handleMouseDown.bind(this), false);
        this.window.addEventListener('mouseup', this.handleMouseUp.bind(this), false);
        this.window.addEventListener('mousemove', this.handleMouseMove.bind(this), false);
        
        // Disable context menu on right-click
        this.window.oncontextmenu = (e) => e.preventDefault();
    }

    private initKeyboardEvents(): void {
        document.addEventListener('keydown', this.handleKeyDown.bind(this), false);
        document.addEventListener('keyup', this.handleKeyUp.bind(this), false);
    }

    private handleMouseWheel(e: WheelEvent): void {
        e.preventDefault(); // Prevent page scrolling
        
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            // Vertical scroll - handle zoom
            this.camera.updateScale(e.deltaY / this.scaleFactor);
        } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            // Horizontal scroll - handle cine
            this.camera.updateCine(e.deltaX / this.cineFactor);
        }
    }

    private handleMouseDown(e: MouseEvent): void {
        if (e.button === 0) {
            this.leftDown = true;
        } else if (e.button === 2) {
            this.rightDown = true;
        }
        this.initPos = [e.pageX, e.pageY];
    }

    private handleMouseUp(e: MouseEvent): void {
        if (e.button === 0) {
            this.leftDown = false;
        } else if (e.button === 2) {
            this.rightDown = false;
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        const dx = e.pageX - this.initPos[0];
        const dy = e.pageY - this.initPos[1];
        
        if (this.leftDown) {
            // Update lighting if shift key is held
            if (this.updateLightSource) {
                this.camera.updateLighting(dx / this.lightFactor, dy / this.lightFactor);
            } else {
                // Rotate view otherwise
                this.camera.updateRotation(-dx / this.rotationFactor, dy / this.rotationFactor);
            }
        } else if (this.rightDown) {
            // Pan view
            this.camera.updatePan(dx * this.panFactor, dy * this.panFactor);
        }
        
        this.initPos = [e.pageX, e.pageY];
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Shift') this.updateLightSource = true;
    }

    private handleKeyUp(e: KeyboardEvent): void {
        if (e.key === 'Shift') this.updateLightSource = false;
    }
}