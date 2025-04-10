import { mat4, vec3 } from 'gl-matrix';
import { Volume } from './volume';

export class Camera {
    private _forward: vec3 = vec3.fromValues(0, 0, 1);
    private _up: vec3 = vec3.fromValues(0, 1, 0);

    private _pan: vec3 = vec3.fromValues(0, 0, 0);
    private _zoom: vec3 = vec3.fromValues(1, 1, 1);

    private _view: mat4 = mat4.create();

    private _lightDirection: vec3 = vec3.fromValues(0, 1, 0);

    private volumeBounds: number[];
    private volumeScale: number[];
    
    /**
     * Creates a new camera for volume visualization
     * @param volume The volume to visualize
     */
    constructor(volume: Volume) {
        this.volumeScale = volume.scale;
        this.volumeBounds = volume.bounds;
        this._pan = vec3.fromValues(0, 0, this.volumeBounds.reduce((acc, val) => acc + val, 0));
    }

    public get lightDirection(): vec3 { return this._lightDirection; }
    
    /**
     * Returns the view matrix
     * @returns The current view matrix
     */
       public get view(): mat4 { 
        // Calculate right vector from forward and up vectors
        const right = vec3.create();
        vec3.cross(right, this._up, this._forward);
        vec3.normalize(right, right);

        // Create view basis matrix (camera orientation)
        const viewBasis = mat4.fromValues(
            right[0], this._up[0], this._forward[0], 0,
            right[1], this._up[1], this._forward[1], 0,
            right[2], this._up[2], this._forward[2], 0,
            0, 0, 0, 1
        );

        const camera = mat4.create();

        // Scale z-axis according to volume-to-data ratio
        mat4.multiply(camera, mat4.fromScaling(mat4.create(), vec3.fromValues(this.volumeScale[0], this.volumeScale[1], this.volumeScale[2])), camera);
        // Ensure (0, 0, 0) is the centre of the volume
        mat4.translate(camera, camera, this.volumeCentre());
        // Apply rotation
        mat4.multiply(camera, viewBasis, camera);
        // Apply zoom
        mat4.multiply(camera, mat4.fromScaling(mat4.create(), this._zoom), camera);
        // Apply pan
        mat4.multiply(camera, mat4.fromTranslation(mat4.create(), this._pan), camera);
        
        mat4.invert(this._view, camera);
        return this._view; 
    }

    /**
     * Calculates the center point of the volume
     * @returns Vector representing the volume center
     */
    private volumeCentre(): vec3 { 
        return vec3.fromValues(
            -this.volumeBounds[0] / 2, 
            -this.volumeBounds[1] / 2, 
            -this.volumeBounds[2] / 2
        ); 
    }

    /**
     * Updates the pan in the xy-plane (pan)
     * @param delta Change in pan [dx, dy]
     */
    public set pan(delta: [number, number]) {
        this._pan[0] += delta[0] / this._zoom[0];
        this._pan[1] += delta[1] / this._zoom[1];
    }

    /**
     * Updates the zoom factor
     * @param delta Change in zoom
     */
    public set zoom(delta: number) {
        if (this._zoom[0] + delta > 0) {
            this._zoom[0] += delta;
            this._zoom[1] += delta;
        }
    }

    /**
     * Updates the camera orientation based on rotation angles
     * @param delta Change in rotation [dx, dy]
     */
    public set rotation(delta: [number, number]) {
        // Calculate right vector
        const right = vec3.create();
        vec3.cross(right, this._forward, this._up);
        
        // Rotate around up vector (y-axis)
        const rotY = mat4.fromRotation(mat4.create(), delta[0], this._up);
        vec3.transformMat4(this._forward, this._forward, rotY);
        
        // Rotate around right vector (x-axis)
        const rotX = mat4.fromRotation(mat4.create(), delta[1], right);
        vec3.transformMat4(this._up, this._up, rotX);
        vec3.transformMat4(this._forward, this._forward, rotX);
    }

    /**
     * Updates the light direction
     * @param delta Change in light direction [dx, dy]
     */
    public set lighting(delta: [number, number]) {
        // Rotate around y-axis for horizontal movement
        const rotX = mat4.fromRotation(mat4.create(), delta[0], [0, 1, 0]);
        
        // Rotate around x-axis for vertical movement
        const rotY = mat4.fromRotation(mat4.create(), delta[1], [1, 0, 0]);
        
        vec3.transformMat4(this._lightDirection, this._lightDirection, rotX);
        vec3.transformMat4(this._lightDirection, this._lightDirection, rotY);
        
        vec3.normalize(this._lightDirection, this._lightDirection);
    }

    /**
     * Updates the pan to center the image when the canvas is resized
     * @param size New dimensions [width, height]
     */
    public resize(size: number[]): void {  
        this._pan[0] = size[0] / 2;
        this._pan[1] = size[1] / 2;
    }

    /**
     * Updates volume parameters when the volume changes
     * @param volume The new volume
     */
    public updateVolume(volume: Volume): void {
        this.volumeScale = volume.scale;
        this.volumeBounds = volume.bounds;
        this._pan[2] = this.volumeBounds.reduce((acc, val) => acc + val, 0);
    }
}