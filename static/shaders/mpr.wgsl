struct Uniforms {
    transform: mat4x4<f32>,
    slab: mat3x2<f32>,
    width: f32,
    level: f32,
    bitsPerVoxel: f32
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var volumeTexture: texture_3d<f32>;
@group(0) @binding(2) var volumeSampler: sampler;

@vertex
fn vert_main(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 0.0, 1.0);
}

fn intensity(sample: vec4<f32>) -> f32 {
    if (uniforms.bitsPerVoxel == 16) { return (sample.x + sample.y * 255) / 256; } // Intensity stored over 8-bit red and green channels
    else { return sample.x; } // Intensity stored over red channel only
}

@fragment
fn frag_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    var maxIntensity: f32 = 0; // Only dealing with unsigned integers
    
    for (var k = 0; k < i32(size.z); k++) {
        var transformed = uniforms.transform * vec4<f32>(coord.xy, f32(k), 1.0);
        // Scale down transformed coordinates to fit within 0->1 range
        var uvz_coords = vec3<f32>(transformed.x / size.x, transformed.y / size.y, transformed.z / size.z);
        
        // Sample the texture regardless of bounds
        var sample = textureSample(volumeTexture, volumeSampler, uvz_coords);
        
        // Only use the sample if it's within bounds
        if (transformed.x >= uniforms.slab[0][0] && transformed.x <= uniforms.slab[0][1] &&
            transformed.y >= uniforms.slab[1][0] && transformed.y <= uniforms.slab[1][1] &&
            transformed.z >= uniforms.slab[2][0] && transformed.z <= uniforms.slab[2][1]) {
            var sampleIntensity = intensity(sample);
            maxIntensity = max(maxIntensity, sampleIntensity);
        }
    }
    var out = (maxIntensity - (uniforms.level + uniforms.width / 2)) / uniforms.width;
    return vec4<f32>(out, out, out, 1);
}