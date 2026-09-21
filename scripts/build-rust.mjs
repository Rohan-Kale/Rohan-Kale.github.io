import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const args = ['--crate-type', 'cdylib', '--edition', '2024', '--target', 'wasm32-unknown-unknown', '-C', 'opt-level=3', '-C', 'panic=abort', '-C', 'strip=symbols'];
// Prefer an installed WASM target. This machine also has a project-local target
// library, downloaded without changing the native simulator or system toolchain.
const sysroot = execFileSync('rustc', ['--print', 'sysroot'], { encoding: 'utf8' }).trim();
if (!existsSync(path.join(sysroot, 'lib/rustlib/wasm32-unknown-unknown/lib'))) {
  const version = execFileSync('rustc', ['--version'], { encoding: 'utf8' }).split(' ')[1];
  const local = path.join(root, `.local/wasm-toolchain/rust-std-${version}-wasm32-unknown-unknown/rust-std-wasm32-unknown-unknown`);
  if (!existsSync(local)) throw new Error('Install the wasm32-unknown-unknown Rust target before rebuilding. The checked-in public/simulator.wasm works without a Rust toolchain.');
  const host = execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/host: (.+)/)[1].trim();
  args.push('--sysroot', local, '-C', `linker=${path.join(sysroot, 'lib/rustlib', host, 'bin', process.platform === 'win32' ? 'rust-lld.exe' : 'rust-lld')}`);
}
args.push(path.join(root, 'rust-simulator/src/lib.rs'), '-o', path.join(root, 'public/simulator.wasm'));
execFileSync('rustc', args, { stdio: 'inherit' });
