// Browser adapter for the original Space Simulator's Barnes–Hut CPU octree.
// No dependencies or desktop renderer; built directly with rustc for WASM.
use std::cell::RefCell;
mod octree;
mod physics {
    #[derive(Clone)]
    pub struct Body { pub position: [f32; 3], pub velocity: [f32; 3], pub acceleration: [f32; 3], pub mass: f32, pub radius: f32 }
    pub mod gpu_octree {
        #[repr(C)]
        pub struct GpuOctreeNode { pub center_of_mass: [f32;4], pub center: [f32;4], pub mass:f32, pub is_leaf:u32, pub body_index:u32, pub _padding:u32, pub children:[u32;8] }
    }
}
use physics::Body;
const G: f32 = 39.4784176;
struct Simulation { bodies: Vec<Body>, output: Vec<f32>, elapsed: f32, nodes: Vec<physics::gpu_octree::GpuOctreeNode> }
thread_local! { static SIM: RefCell<Simulation> = RefCell::new(Simulation { bodies: Vec::new(), output: Vec::new(), elapsed: 0.0, nodes: Vec::new() }); }
fn random(seed: &mut u32) -> f32 { *seed = seed.wrapping_mul(1664525).wrapping_add(1013904223); (*seed >> 8) as f32 / 16777216.0 }
fn body(position: [f32;3], velocity: [f32;3], mass: f32, radius: f32) -> Body { Body { position, velocity, acceleration:[0.;3], mass, radius } }
impl Simulation {
    fn reset(&mut self, count: usize, preset: u32, mut seed: u32) {
        self.bodies.clear(); self.elapsed = 0.;
        let count = count.clamp(16, 10009);
        if preset == 1 {
            self.bodies.push(body([-0.55,0.,0.],[0.,0.,-3.],0.5,0.08));
            self.bodies.push(body([0.55,0.,0.],[0.,0.,3.],0.5,0.08));
        } else {
            self.bodies.push(body([0.;3],[0.;3],1.,0.25));
        }
        if preset == 0 {
            // The eight tuples match the original src/physics/solar_system.rs.
            let planets: [(f32,f32,f32);8] = [(1.65e-7,0.39,0.02),(2.45e-6,0.72,0.04),(3e-6,1.,0.05),(3.22e-7,1.52,0.05),(9.54e-4,5.2,0.22),(2.85e-4,9.54,0.20),(4.37e-5,19.2,0.17),(5.15e-5,30.1,0.17)];
            for (mass,distance,radius) in planets { self.bodies.push(body([distance,0.,0.],[0.,0.,(G/distance).sqrt()],mass,radius)); }
        }
        while self.bodies.len() < count {
            let angle = random(&mut seed)*std::f32::consts::TAU;
            let distance = if preset == 0 { 2.2+random(&mut seed) } else { 1.8+random(&mut seed)*5.8 };
            let speed = (G/distance).sqrt();
            let y = (random(&mut seed)-0.5)*if preset == 2 { 0.6 } else { 0.02 };
            self.bodies.push(body([distance*angle.cos(),y,distance*angle.sin()],[-angle.sin()*speed,0.,angle.cos()*speed],if preset == 2 { 0.00005 } else { 1e-10 },0.005));
        }
        self.output.resize(count*8,0.);
        self.pack();
    }
    fn pack(&mut self) {
        for (b,out) in self.bodies.iter().zip(self.output.chunks_exact_mut(8)) {
            out[..3].copy_from_slice(&b.position); out[3..6].copy_from_slice(&b.velocity); out[6]=b.mass; out[7]=b.radius;
        }
    }
    fn advance(&mut self, dt:f32, gravity:f32, theta:f32) {
        if self.bodies.is_empty() { return; }
        let dt=dt.clamp(0.,0.005);
        for b in &mut self.bodies { for axis in 0..3 { b.velocity[axis]+=b.acceleration[axis]*dt*0.5; b.position[axis]+=b.velocity[axis]*dt; } }
        let extent=self.bodies.iter().flat_map(|b|b.position).fold(1_f32,|m,x|m.max(x.abs()))+1.;
        let mut tree=octree::OctreeNode::new([0.;3],extent);
        for i in 0..self.bodies.len() { tree.insert(i,&self.bodies,0); }
        tree.compute_center_of_mass(&self.bodies);
        let acceleration: Vec<[f32;3]>= (0..self.bodies.len()).map(|i| {
            let f=tree.compute_force(i,&self.bodies,theta.clamp(0.2,1.2),G*gravity.clamp(0.1,3.));
            f.map(|v|v/self.bodies[i].mass)
        }).collect();
        for (b, a) in self.bodies.iter_mut().zip(acceleration) { b.acceleration=a; for axis in 0..3 { b.velocity[axis]+=a[axis]*dt*0.5; } }
        self.elapsed+=dt;
        self.pack();
    }
}
#[unsafe(no_mangle)] pub extern "C" fn reset(count:u32,preset:u32,seed:u32) { SIM.with_borrow_mut(|s|s.reset(count as usize,preset,seed)); }
#[unsafe(no_mangle)] pub extern "C" fn step(dt:f32,gravity:f32,theta:f32) { SIM.with_borrow_mut(|s|s.advance(dt,gravity,theta)); }
#[unsafe(no_mangle)] pub extern "C" fn data_ptr()->*const f32 { SIM.with_borrow(|s|s.output.as_ptr()) }
#[unsafe(no_mangle)] pub extern "C" fn body_count()->u32 { SIM.with_borrow(|s|s.bodies.len() as u32) }
#[unsafe(no_mangle)] pub extern "C" fn elapsed()->f32 { SIM.with_borrow(|s|s.elapsed) }


// The browser reads GPU positions back into this packed buffer, then asks the
// original Rust octree to produce the GPU node layout used by gravity.wgsl.
#[unsafe(no_mangle)] pub extern "C" fn build_tree() {
    SIM.with_borrow_mut(|s| {
        for (b,input) in s.bodies.iter_mut().zip(s.output.chunks_exact(8)) {
            b.position.copy_from_slice(&input[..3]); b.velocity.copy_from_slice(&input[3..6]);
        }
        let extent=s.bodies.iter().flat_map(|b|b.position).fold(100_f32,|m,x|m.max(x.abs()))+1.;
        let mut tree=octree::OctreeNode::new([0.;3],extent);
        for i in 0..s.bodies.len() { tree.insert(i,&s.bodies,0); }
        tree.compute_center_of_mass(&s.bodies); s.nodes.clear(); tree.flatten(&mut s.nodes);
    });
}
#[unsafe(no_mangle)] pub extern "C" fn nodes_ptr()->*const physics::gpu_octree::GpuOctreeNode { SIM.with_borrow(|s|s.nodes.as_ptr()) }
#[unsafe(no_mangle)] pub extern "C" fn node_count()->u32 { SIM.with_borrow(|s|s.nodes.len() as u32) }
