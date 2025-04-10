diagnostic(off, derivative_uniformity);

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

fn intensity(sample: vec4<f32>) -> f32 {
    return (sample.x + sample.y * 255) / 256; // Convert from RG8 format to normalised 16-bit value
}

@fragment
fn frag_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    var maxIntensity: f32 = 0;

    // Calculate ray origin and direction in volume space
    var pos = uniforms.transform * vec4<f32>(coord.xy, 0.0, 1.0); // Ray origin
    var dir = uniforms.transform * vec4<f32>(0.0, 0.0, 1.0, 0.0); // Ray direction
    
    // Find intersection with volume bounds
    var intersect = ray_box_intersection(vec3<f32>(0.0), size, pos.xyz, dir.xyz);
    var near = max(0, i32(intersect.x)); // Entry point (clamp to 0 if outside)
    var far = i32(intersect.y);          // Exit point
    
    // Iterate through all slices of the volume
    for (var k = near; k <= far; k++) {
        // Transform current pixel and slice position using the MPR transformation matrix
        var transformed = uniforms.transform * vec4<f32>(coord.xy, f32(k), 1.0);
        // Normalise coordinates to 0-1 range for texture sampling
        var coords = transformed.xyz / size;
        // Sample the volume at the current position
        var sample = textureSample(volumeTexture, volumeSampler, coords);
        var sampleIntensity = intensity(sample);
        // Track the maximum intensity encountered along the ray
        maxIntensity = max(maxIntensity, sampleIntensity);
    }
    
    // Apply window width/level adjustment to the maximum intensity
    var out = (maxIntensity - (uniforms.windowLevel + uniforms.windowWidth / 2)) / uniforms.windowWidth;
    return vec4<f32>(out, out, out, 1); // Return adjusted intensity as a grayscale color
}