struct Uniforms {
    transform: mat4x4<f32>,
    windowWidth: f32,
    windowLevel: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var volumeTexture: texture_3d<f32>;
@group(0) @binding(2) var volumeSampler: sampler;

@vertex
fn vert_main(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
    // Create full-screen triangle using vertex index, using points: (-1,3), (-1,-1), and (3,-1)
    // which is larger than the screen space (-1 to 1), which is more efficient than using two triangles.
    var pos = array<vec2<f32>, 3>(
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    return vec4<f32>(pos[idx], 0.0, 1.0);
}

fn intensity(sample: vec4<f32>) -> f32 {
    return (sample.x + sample.y * 255) / 256; // Convert from RG8 format to normalised 16-bit value
}

@fragment
fn frag_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    var maxIntensity: f32 = 0;
    
    // Iterate through all slices of the volume
    for (var k = 0; k < i32(size.z); k++) {
        // Transform current pixel and slice position using the MPR transformation matrix
        var transformed = uniforms.transform * vec4<f32>(coord.xy, f32(k), 1.0);
        // Normalize coordinates to 0-1 range for texture sampling
        var coords = transformed.xyz / size;
        
        // Sample the volume at the current position
        var sample = textureSample(volumeTexture, volumeSampler, coords);
        
        // Only use samples within the volume bounds (0-1 in normalized coordinates)
       if (all(coords >= vec3<f32>(0.0)) && all(coords <= vec3 <f32>(1.0))) {
            var sampleIntensity = intensity(sample);
            // Track the maximum intensity encountered along the ray
            maxIntensity = max(maxIntensity, sampleIntensity);
        }
    }
    
    // Apply window width/level adjustment to the maximum intensity
    var out = (maxIntensity - (uniforms.windowLevel + uniforms.windowWidth / 2)) / uniforms.windowWidth;
    return vec4<f32>(out, out, out, 1); // Return adjusted intensity as a grayscale color
}