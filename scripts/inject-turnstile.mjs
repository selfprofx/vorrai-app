/**
 * Postbuild: inject the Cloudflare Turnstile site key into the built bundle.
 *
 * Angular's `define` (angular.json) bakes the literal placeholder
 * `REPLACE_AT_BUILD_TIME` into the production bundle as `turnstileSiteKey`.
 * Vercel can't substitute that on its own, so we do it here over the emitted
 * JS, reading the PUBLIC site key from the TURNSTILE_SITE_KEY env var.
 *
 * On Vercel a missing key is a hard error — shipping the placeholder leaves
 * the login / password-reset Turnstile widget unable to render, which keeps
 * those submit buttons permanently disabled. Locally it's a soft warning.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PLACEHOLDER = 'REPLACE_AT_BUILD_TIME';
const DIST = 'dist/vendia/browser';
const key = process.env.TURNSTILE_SITE_KEY;

if (!key) {
  const msg =
    '[inject-turnstile] TURNSTILE_SITE_KEY is not set — ' +
    `bundle keeps the "${PLACEHOLDER}" placeholder and the captcha widget will not render.`;
  if (process.env.VERCEL) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
  process.exit(0);
}

function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...jsFiles(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

let patched = 0;
for (const file of jsFiles(DIST)) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes(PLACEHOLDER)) continue;
  writeFileSync(file, src.split(PLACEHOLDER).join(key));
  patched++;
}

if (patched === 0) {
  console.error(
    `[inject-turnstile] placeholder "${PLACEHOLDER}" not found in ${DIST} — ` +
      'site key was NOT injected. Check the angular.json define.',
  );
  process.exit(1);
}

console.log(`[inject-turnstile] injected site key into ${patched} file(s).`);
