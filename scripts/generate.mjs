import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');
const data = JSON.parse(await read('content/portfolio.json'));
if (data.resume?.startsWith('/') && !/^\/files\/[a-zA-Z0-9_-]+\.pdf$/.test(data.resume)) throw new Error('Use a PDF such as /files/resume.pdf or an HTTPS URL.');
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const url = (value) => {
  if (!value) return null;
  if (!/^https:\/\//.test(value)) throw new Error(`Use an https URL: ${value}`);
  new URL(value);
  return esc(value);
};
const external = (value, label) => value ? `<a class="text-link" href="${url(value)}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (opens in a new tab)</span></a>` : `<span class="unavailable">${label} — not added</span>`;
const tags = (items) => items.map((item) => `<span class="tag">${esc(item)}</span>`).join('');
const socialIcon = (value, label, path) => value ? `<a class="social-icon" href="${url(value)}" target="_blank" rel="noopener noreferrer" aria-label="${label} (opens in a new tab)" title="${label}"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="${path}"/></svg></a>` : '';
const githubIcon = 'M12 .297a12 12 0 0 0-3.793 23.385c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 6.006 0c2.291-1.552 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.769.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.294c0 .319.216.694.825.576A12 12 0 0 0 12 .297Z';
const linkedinIcon = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z';
const ids = new Set();
const projects = data.projects.map((p, i) => {
  if (!/^[a-z][a-z0-9-]*$/.test(p.id) || ids.has(p.id)) throw new Error('Project IDs must be unique lowercase slugs.');
  ids.add(p.id);
  if (p.image && !/^\/images\/[a-zA-Z0-9._/-]+$/.test(p.image)) throw new Error('Put project images under /images/.');
  return `<article class="project" id="${esc(p.id)}" tabindex="-1">
    ${p.image ? `<img class="project-image" src=".${esc(p.image)}" alt="${esc(p.imageAlt)}" loading="lazy" width="960" height="600">` : ''}
    <div class="project-copy"><h3>${esc(p.title)}${p.status ? ` <span class="project-status">— ${esc(p.status)}</span>` : ''}</h3><p>${esc(p.description)}</p><div class="tags">${tags(p.technologies)}</div>${p.demo || p.source || p.codePending ? `<div class="project-links">${p.demo ? external(p.demo, 'Live demo') : ''}${p.source ? external(p.source, 'Source code') : p.codePending ? '<span class="unavailable">Code pending</span>' : ''}</div>` : ''}</div>
  </article>`;
}).join('');
const template = await read('src/template.html');
const replacements = {
  NAME: esc(data.name), NAME_LOWER: esc(data.name.toLowerCase()), ROLE: esc(data.role), INTRO: esc(data.intro),
  RESUME: data.resume ? `<a class="homepage-link" href="${data.resume.startsWith('/files/') ? `.${esc(data.resume)}` : url(data.resume)}" target="_blank" rel="noopener noreferrer">Resume<span class="sr-only"> (opens in a new tab)</span></a>` : '<a class="homepage-link" href="./resume-placeholder.html">Resume<small>Not added yet</small></a>',
  SOCIAL_ICONS: `<div class="social-icons">${data.contact.email ? `<a class="social-icon email-link" href="mailto:${esc(data.contact.email)}" aria-label="Email ${esc(data.contact.email)}" title="${esc(data.contact.email)}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg></a>` : ''}${socialIcon(data.contact.github, 'GitHub', githubIcon)}${socialIcon(data.contact.linkedin, 'LinkedIn', linkedinIcon)}</div>`,
  ABOUT_HEADING: esc(data.about.heading), ABOUT: data.about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join(''),
  PROJECTS: projects,
  SATELLITES: data.projects.map((p, i) => `<a href="#${esc(p.id)}" class="satellite-link"><span aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${esc(p.title)}</a>`).join(''),
  SKILLS: data.skills.map((s) => `<div class="skill-group"><span class="skill-label">${esc(s.title)}</span><span class="skill-items">${s.items.map(esc).join(', ')}</span></div>`).join(''),
  EXPERIENCE: data.experience.map((e) => `<article class="experience-item"><h3>${esc(e.role)}</h3><p class="organization"><span>${esc(e.organization)}</span><span class="period">${esc(e.period)}</span></p><p>${esc(e.description)}</p></article>`).join(''),
  CONTACT_HEADING: esc(data.contact.heading), CONTACT_DESCRIPTION: esc(data.contact.description),
  CONTACT_LINKS: `<div class="contact-links">${data.contact.email ? (() => { if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(data.contact.email)) throw new Error('Invalid email'); return `<a class="text-link" href="mailto:${esc(data.contact.email)}">${esc(data.contact.email)}</a>`; })() : '<p class="contact-placeholder">[Add your email address]</p>'}${external(data.contact.github, 'GitHub')}${external(data.contact.linkedin, 'LinkedIn')}</div>`
};
await writeFile(path.join(root, 'index.html'), template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
  if (!(key in replacements)) throw new Error(`Unknown content field ${key}`);
  return replacements[key];
}));
// Reuse the actual Rust initializer, kept as an unchanged local reference copy.
const rust = await read('reference/solar_system.rs');
const g = Number(rust.match(/const G: f32 = ([\d.]+);/)[1]);
const planets = [...rust.matchAll(/\/\/ (Mercury|Venus|Earth|Mars|Jupiter|Saturn|Uranus|Neptune)\s*\(([\de.+-]+), ([\d.]+), ([\d.]+)\)/g)].map((m) => ({ name: m[1], mass: Number(m[2]), distance: Number(m[3]), radius: Number(m[4]) }));
if (planets.length !== 8 || !Number.isFinite(g)) throw new Error('Rust solar-system source format changed.');
await mkdir(path.join(root, 'src/generated'), { recursive: true });
await writeFile(path.join(root, 'src/generated/solar-system.js'), `// Generated from reference/solar_system.rs. Run npm run content.\nexport const G = ${g};\nexport const planets = ${JSON.stringify(planets, null, 2)};\n`);
console.log(`Generated static portfolio: ${data.projects.length} projects, ${planets.length} Rust planet definitions.`);
