struct Uniforms {
    transform: mat4x4<f32>,      // View transformation matrix
    lightPos: vec3<f32>,         // Position of the light source
    bbox: vec3<f32>,             // Bounding box dimensions
    lightColour: vec3<f32>,      // Color of the light source
    brightness: f32,             // Overall brightness adjustment
    shininess: f32,              // Specular highlight sharpness
    ambient: f32,                // Ambient light intensity
    transferWidth: f32,          // Width of the transfer function texture
    bitsPerVoxel: f32            // Bits per voxel in the volume data
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;              // Uniform buffer
@group(0) @binding(1) var volumeTexture: texture_3d<f32>;           // 3D volume texture
@group(0) @binding(2) var volumeSampler: sampler;                   // Sampler for the volume texture
@group(0) @binding(3) var transferTexture: texture_1d<f32>;         // 1D transfer function texture

// Vertex shader - Simply passes through the 2D position to create a full-screen quad
@vertex
fn vert_main(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 0.0, 1.0);
}

// Converts a sample from the volume texture to a normalised intensity value
fn intensity(sample: vec4<f32>) -> f32 {
    return (sample.x + sample.y * 255) / 256; // Convert from RG8 format to normalised 16-bit value
}

// Calculates the intersection points of a ray with an axis-aligned bounding box
// Algorithm - https://education.siggraph.org/static/HyperGraph/raytrace/rtinter3.htm
fn ray_box_intersection(bboxMin: vec3<f32>, bboxMax: vec3<f32>, pos: vec3<f32>, dir: vec3<f32>) -> vec2<f32> {
    var inv_dir = 1 / dir;                    // Inverse of ray direction
    var bot = inv_dir * (bboxMin - pos);      // Distances to minimum bounds
    var top = inv_dir * (bboxMax - pos);      // Distances to maximum bounds
    var rmin = min(top, bot);                 // Nearest intersection for each axis
    var rmax = max(top, bot);                 // Farthest intersection for each axis
    var near = max(rmin.x, max(rmin.y, rmin.z)); // Entry point - maximum of minimum intersections
    var far = min(rmax.x, min(rmax.y, rmax.z));  // Exit point - minimum of maximum intersections
    return vec2<f32>(near, far);
}

// Calculates the normal vector at a given position using central differences
fn normal(pos: vec3<f32>) -> vec3<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    
    // Calculate small offset for sampling
    let offset = 1.0 / size;
    
    // Calculate gradient using central differences along each axis
    var delta: vec3<f32>;
    delta.x = intensity(textureSample(volumeTexture, volumeSampler, pos + vec3<f32>(offset.x, 0.0, 0.0))) - 
              intensity(textureSample(volumeTexture, volumeSampler, pos - vec3<f32>(offset.x, 0.0, 0.0)));
    delta.y = intensity(textureSample(volumeTexture, volumeSampler, pos + vec3<f32>(0.0, offset.y, 0.0))) - 
              intensity(textureSample(volumeTexture, volumeSampler, pos - vec3<f32>(0.0, offset.y, 0.0)));
    delta.z = intensity(textureSample(volumeTexture, volumeSampler, pos + vec3<f32>(0.0, 0.0, offset.z))) - 
              intensity(textureSample(volumeTexture, volumeSampler, pos - vec3<f32>(0.0, 0.0, offset.z)));
    return normalize(delta);
}

// Fragment shader - Implements the volume ray casting algorithm
@fragment
fn frag_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    var accColour = vec4<f32>(0.0, 0.0, 0.0, 0.0);  // Accumulated color (RGBA)

    // Calculate ray origin and direction in volume space
    var pos = uniforms.transform * vec4<f32>(coord.xy, 0.0, 1.0);  // Ray origin
    var dir = uniforms.transform * vec4<f32>(0.0, 0.0, 1.0, 0.0);  // Ray direction
    
    // Find intersection with volume bounds
    var intersect = ray_box_intersection(vec3<f32>(0.0), size, pos.xyz, dir.xyz);
    var near = max(0, i32(intersect.x));  // Entry point (clamp to 0 if outside)
    var far = i32(intersect.y);           // Exit point

    // Ray marching loop - step through the volume
    for (var k = 0; k < i32(size.z); k++) {
        var ray_pos = pos.xyz + f32(k) * dir.xyz;  // Current position along the ray
        // Scale down transformed coordinates to fit within 0->1 range
        var coords = ray_pos / size;
        
        // Sample the volume at the current position
        let val = intensity(textureSample(volumeTexture, volumeSampler, coords));
        // Calculate the normal at the current position
        var norm = normal(coords); 

        if (all(coords >= vec3<f32>(0.0)) && all(coords <= vec3 <f32>(1.0))) {
        
            // Look up color in transfer function
            let tfIndex = i32(val * uniforms.transferWidth);
            var colour = textureLoad(transferTexture, tfIndex, 0);

            // Lighting calculation using Blinn-Phong model
            var lightDir = normalize(uniforms.lightPos - coords);     // Direction to light
            var viewDir = normalize(coords);                          // Direction to viewer
            var halfDir = normalize(lightDir + viewDir);              // Half vector for specular
            
            // Calculate lighting components
            var specular = pow(max(0.0, dot(norm, halfDir)), uniforms.shininess);  // Specular term
            var diffuse = max(0.0, dot(norm, lightDir));                           // Diffuse term
            
            // Apply lighting and brightness with ambient term
            var litColor = colour.rgb * diffuse + uniforms.ambient * colour.rgb * uniforms.lightColour + specular * uniforms.lightColour;
            colour = vec4<f32>(litColor, colour.a) * uniforms.brightness;

            // Front-to-back composition using alpha blending
            var alpha = (1.0 - accColour.a) * colour.a;
            accColour = vec4<f32>(
                accColour.rgb + alpha * colour.rgb,  // Blend colors based on alpha
                accColour.a + alpha                  // Accumulate alpha
            );
        }
    }

    return accColour;  // Return the final composited color
 }