// Browser adaptation of reference/gravity.wgsl. Original repository unchanged.
struct Body {
    position: vec4<f32>,
    velocity: vec4<f32>,
    acceleration: vec4<f32>,
    mass: f32,
    radius: f32,
    padding: vec2<f32>,
}

struct OctreeNode {
    center_of_mass: vec4<f32>,
    center: vec4<f32>, // xyz + half_size
    mass: f32,
    is_leaf: u32,
    body_index: u32,
    padding: u32,
    children: array<u32, 8>,
}

struct SimulationParams {
    dt: f32,
    gravity: f32,
    theta: f32,
    padding: f32,
}


@group(0) @binding(0)
var<storage, read_write> bodies: array<Body>;

@group(0) @binding(1)
var<storage, read> octree: array<OctreeNode>;

@group(0) @binding(2)
var<uniform> sim: SimulationParams;

// Snapshot avoids cross-workgroup read/write races in the native in-place pass.
@group(0) @binding(3)
var<storage, read> input_bodies: array<Body>;


const G: f32 = 39.4784176; // Solar units: AU, years, solar masses
// Theta is adjustable in the browser adapter.
const SOFTENING: f32 = 0.000001;

const EMPTY: u32 = 4294967295u;


fn compute_force(body_index: u32) -> vec3<f32> {

    var force = vec3<f32>(0.0);

    var stack: array<u32, 64>;
    var stack_size: u32 = 1u;

    stack[0] = 0u; // root node

    let body_pos = input_bodies[body_index].position.xyz;


    while(stack_size > 0u) {

        stack_size -= 1u;

        let node = octree[stack[stack_size]];


        if(node.mass <= 0.0) {
            continue;
        }


        // Leaf node
        if(node.is_leaf == 1u) {

            if(node.body_index != EMPTY &&
               node.body_index != body_index) {

                let other = input_bodies[node.body_index];

                let dir = other.position.xyz - body_pos;

                let dist2 =
                    dot(dir, dir) + SOFTENING;

                let inv_dist =
                    inverseSqrt(dist2);

                force += dir *
                    (G * sim.gravity * other.mass *
                    inv_dist *
                    inv_dist *
                    inv_dist);
            }

            continue;
        }


        // Internal node
        let dir = node.center_of_mass.xyz - body_pos;

        let dist2 =
            dot(dir, dir) + SOFTENING;

        let distance =
            sqrt(dist2);


        let size =
            node.center.w * 2.0;


        // Barnes-Hut approximation
        if(size / distance < sim.theta && !all(abs(body_pos - node.center.xyz) <= vec3<f32>(node.center.w))) {

            let inv_dist =
                inverseSqrt(dist2);

            force += dir *
                (G * sim.gravity * node.mass *
                inv_dist *
                inv_dist *
                inv_dist);

        } else {

            // open children
            for(var c:u32 = 0u; c < 8u; c++) {

                let child = node.children[c];

                if(child != EMPTY &&
                   stack_size < 64u) {

                    stack[stack_size] = child;
                    stack_size++;
                }
            }
        }
    }


    return force;
}



@compute @workgroup_size(64)
fn main(
    @builtin(global_invocation_id) id: vec3<u32>
) {

    let i = id.x;


    if(i >= arrayLength(&bodies)) {
        return;
    }


    let old_acceleration =
        input_bodies[i].acceleration.xyz;


    // Leapfrog integration
    let half_velocity =
        input_bodies[i].velocity.xyz +
        old_acceleration * sim.dt * 0.5;


    let new_position =
        input_bodies[i].position.xyz +
        half_velocity * sim.dt;


    // calculate new gravity
    let new_acceleration =
        compute_force(i);


    let new_velocity =
        half_velocity +
        new_acceleration * sim.dt * 0.5;



    bodies[i].position =
        vec4<f32>(new_position, 0.0);


    bodies[i].velocity =
        vec4<f32>(new_velocity, 0.0);


    bodies[i].acceleration =
        vec4<f32>(new_acceleration, 0.0);
}
