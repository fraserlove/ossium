import { mat4, vec3 } from 'gl-matrix';
import { Volume } from '../types/volume';

export class Camera {
    private _forward: vec3 = vec3.fromValues(0, 0, 1);
    private _up: vec3 = vec3.fromValues(0, 1, 0);

    private _position: vec3 = vec3.fromValues(0, 0, 0);
    private _zoom: vec3 = vec3.fromValues(1, 1, 1);

    private _view: mat4 = mat4.create();

    private _lightDir: vec3 = vec3.fromValues(0, 1, 0);

    private volumeCentre: vec3;
    private volumeScale: vec3;
    
    /**
     * Creates a new camera for volume visualization
     * @param volumeBounds The bounds of the volume
     * @param volumeScale The scale of the volume
     */
    constructor(volumeBounds: number[], volumeScale: number[]) {
        const bounds = vec3.fromValues(...(volumeBounds as [number, number, number]));
        this.volumeScale = vec3.fromValues(...(volumeScale as [number, number, number]));
        this.volumeCentre = vec3.scale(vec3.create(), bounds, 0.5);
        this._position = vec3.fromValues(0, 0, -vec3.length(bounds));
    }

    public get lightDir(): vec3 { return this._lightDir; }
    
    /**
     * Returns the view matrix
     * @returns The current view matrix
     */
    public get view(): mat4 { 
        const right = vec3.create();
        vec3.cross(right, this._up, this._forward);
        vec3.normalize(right, right);

        // Camera rotation matrix
        const rotation = mat4.transpose(mat4.create(), mat4.fromValues(
            right[0], this._up[0], this._forward[0], 0,
            right[1], this._up[1], this._forward[1], 0,
            right[2], this._up[2], this._forward[2], 0,
            0, 0, 0, 1));

        this._view = mat4.create();
        mat4.multiply(this._view, mat4.fromTranslation(mat4.create(), this._position), this._view);
        mat4.multiply(this._view, mat4.fromScaling(mat4.create(), this._zoom), this._view);
        mat4.multiply(this._view, rotation, this._view);
        mat4.multiply(this._view, mat4.fromTranslation(mat4.create(), this.volumeCentre), this._view);
        mat4.multiply(this._view, mat4.fromScaling(mat4.create(), this.volumeScale), this._view);
        return this._view; 
    }

    /**
     * Updates the camera position in the xy-plane
     * @param delta Change in position [dx, dy]
     */
    public set pan(delta: [number, number]) {
        this._position[0] -= delta[0];
        this._position[1] -= delta[1];
    }

    /**
     * Updates the camera zoom
     * @param delta Change in zoom
     */
    public set zoom(delta: number) { 
        if (this._zoom[0] - delta > 0) {
            this._zoom[0] -= delta;
            this._zoom[1] -= delta;
        }
    }

    /**
     * Updates the camera orientation
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
        
        vec3.transformMat4(this._lightDir, this._lightDir, rotX);
        vec3.transformMat4(this._lightDir, this._lightDir, rotY);
    }

    /**
     * Centres the camera on the volume
     * @param size The dimensions of the canvas [width, height]
     */
    public recentre(size: [number, number]): void {  
        this._position[0] = -size[0] / 2;
        this._position[1] = -size[1] / 2;
    }
}