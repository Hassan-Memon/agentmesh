// OpenNext adapter config for Cloudflare Workers (npm run cf:build).
// Every page is dynamic and the demo keeps its data in the browser, so no incremental cache
// (R2 / KV) is needed: the default in-memory behaviour keeps the deploy on the free plan.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
