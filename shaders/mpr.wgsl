struct Uniforms {
    transform: mat4x4<f32>,      // Transformation matrix for MPR plane
    width: f32,                  // Window width for intensity windowing
    level: f32,                  // Window level (center) for intensity windowing
    bitsPerVoxel: f32            // Number of bits per voxel in the volume data
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;              // Uniform buffer
@group(0) @binding(1) var volumeTexture: texture_3d<f32>;           // 3D volume texture
@group(0) @binding(2) var volumeSampler: sampler;                   // Sampler for the volume texture

// Vertex shader - Creates a full-screen quad for fragment processing
@vertex
fn vert_main(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 0.0, 1.0);
}

// Converts a sample from the volume texture to a normalised intensity value
fn intensity(sample: vec4<f32>) -> f32 {
    return (sample.x + sample.y * 255) / 256; // Convert from RG8 format to normalised 16-bit value
}

// Fragment shader - Implements Maximum Intensity Projection (MIP) rendering
@fragment
fn frag_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));         // Get volume dimensions
    var maxIntensity: f32 = 0;                                      // Track maximum intensity along ray
    
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
            // Keep track of the maximum intensity encountered
            maxIntensity = max(maxIntensity, sampleIntensity);
        }
    }
    
    // Apply window width/level adjustment to the maximum intensity
    var out = (maxIntensity - (uniforms.level + uniforms.width / 2)) / uniforms.width;
    return vec4<f32>(out, out, out, 1); // Return adjusted intensity as a grayscale color
}