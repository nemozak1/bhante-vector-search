# Deployment runbook — Vercel + Neon + Cloudflare + GitHub Actions

End-to-end first deploy of the SvelteKit app to Vercel, Postgres+pgvector on Neon, custom domain via Cloudflare, daily DB backups via GitHub Actions to Cloudflare R2.

Estimated time: **~90 minutes start to finish**, of which ~30 min is waiting on DNS propagation.

---

## 0. Pre-flight (~10 min)

Things you need before starting:

- [ ] GitHub account with push access to `nemozak1/bhante-vector-search`
- [ ] OpenAI API key (https://platform.openai.com/api-keys) — already have one for local dev
- [ ] Voyage API key (https://dash.voyageai.com — free signup, no card; first 200M tokens free)
- [ ] Card on file at Vercel (free, but Pro upgrade needs it later)
- [ ] Card at Cloudflare (only needed if domain costs > free credit)
- [ ] Local repo clean: `git status` shows no uncommitted work
- [ ] Local tests green: `npm run test:e2e`

Generate the production Better Auth secret now and **save it somewhere durable** — you'll paste it twice:

```bash
openssl rand -base64 32
```

Generate a different one for `R2_SECRET_ACCESS_KEY` and save it later.

---

## 1. Switch SvelteKit adapter to Vercel (~5 min)

Local dev keeps working unchanged (Vite). Only `npm run build` and `npm run start` change.

```bash
npm install -D @sveltejs/adapter-vercel
npm uninstall @sveltejs/adapter-node
```

Edit `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      runtime: 'nodejs20.x'  // or 'nodejs22.x' if your code uses it
    })
  }
};
```

Remove the now-unused `start` script from `package.json` (Vercel runs the function bundle directly):

```diff
- "start": "node build/index.js",
```

Sanity check the build still works:

```bash
npm run build
```

You should see `.vercel/output/` created. Don't commit `.vercel/` — add to `.gitignore`:

```
# Vercel build output
.vercel/
```

Commit:

```bash
git add svelte.config.js package.json package-lock.json .gitignore
git commit -m "switch to adapter-vercel for production deploy"
git push origin main
```

---

## 2. Provision Neon via Vercel Marketplace (~5 min)

Doing this from the Vercel side (rather than signing up at neon.com directly) gives you the **native integration**: Vercel automatically injects `DATABASE_URL` and creates a Neon branch per Vercel preview deploy.

1. Go to https://vercel.com/new
2. **Import Git Repository** → pick `nemozak1/bhante-vector-search`
3. **Don't deploy yet** — click "Skip" or close. We'll come back after env vars.
4. In the Vercel dashboard for the new project: **Storage → Browse Marketplace → Neon → Add Integration**
5. Plan: **Free** for now (1 GB storage, 6h PITR). Pick a region close to your testers (`Frankfurt eu-central-1` for UK/EU; `Washington D.C. us-east-1` for US).
6. Click Create. Vercel adds three env vars automatically:
   - `DATABASE_URL` (pooled connection — what your app uses)
   - `DATABASE_URL_UNPOOLED` (direct connection — for migrations)
   - `POSTGRES_URL` (alias)

**Verify**: Vercel project → Settings → Environment Variables → confirm `DATABASE_URL` exists for `Production`, `Preview`, `Development`.

---

## 3. Add the rest of the env vars in Vercel (~3 min)

Vercel Dashboard → your project → **Settings → Environment Variables**. Add each, scoped to **Production** (also Preview if you want preview deploys to fully work):

| Name | Value | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | from platform.openai.com |
| `BETTER_AUTH_SECRET` | the openssl output from step 0 | min 32 chars |
| `BETTER_AUTH_URL` | `https://your-vercel-url.vercel.app` | update after step 5 |
| `VOYAGE_API_KEY` | `pa-...` | from dash.voyageai.com |
| `RERANK_ENABLED` | `true` | turns on the Voyage reranker |
| `RERANK_MODEL` | `rerank-2.5-lite` | optional; this is the default |
| `RERANK_OVERFETCH` | `4` | optional; this is the default |

`DATABASE_URL` is already there from step 2.

---

## 4. First deploy (~3 min)

1. Vercel dashboard → Deployments → **Redeploy** (or push any commit to `main`).
2. Watch the build log. Expect:
   - `npm install`
   - `vite build` runs successfully
   - `Deployment Ready` in 1-2 min
3. Click **Visit** to open the deployed URL (e.g. `bhante-vector-search-abc123.vercel.app`).
4. **Migrations run automatically** on the first request via `hooks.server.ts`. The first page load may take 2-3s as a result.
5. Sign-up: click `/login` → "Sign up", create your real account. You should land on `/search` if Better Auth is wired correctly.

**Verify**:
```bash
# from your laptop, after pulling the Neon DATABASE_URL from Vercel
psql "$NEON_DATABASE_URL" -c "select email from \"user\";"
```
You should see your sign-up email.

---

## 5. Migrate the chunks data (~10 min)

Your local Postgres has 13K embedded chunks; production Neon is empty. Re-ingesting via Python would cost ~$0.17 of OpenAI credits and take ~10 min; pg_dump+restore is free and faster.

Pull `DATABASE_URL` from Vercel:

```bash
# Vercel CLI: vercel env pull --environment=production .env.production
# OR copy from dashboard → Settings → Environment Variables → reveal
export NEON_DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require'
```

Dump local chunks + the schema_migrations table (so the migration runner doesn't try to re-apply 0004_pgvector):

```bash
pg_dump --no-owner --no-acl \
  -h localhost -p 5433 -U bhante \
  -t chunks \
  bhante > /tmp/chunks.sql
```

Restore to Neon:

```bash
psql "$NEON_DATABASE_URL" -f /tmp/chunks.sql
```

Verify:
```bash
psql "$NEON_DATABASE_URL" -c "select collection, count(*) from chunks group by collection;"
# Expect: bhante_epub_search 4113, bhante_seminar_search 8961
```

Test a search end-to-end via the deployed URL — search "meditation" on `/search`, you should get results within ~1s.

---

## 6. Custom domain via Cloudflare (~20 min including DNS wait)

### 6a. Register the domain (~5 min)

If you don't already own one:

1. Cloudflare dashboard → **Domain Registration → Register Domains**
2. Search for the name. Pick `.org` (~$7.50/yr first year, $10.13 renewal) or `.com` (~$10/yr).
3. Buy. Cloudflare auto-creates the DNS zone.

### 6b. Add the domain to Vercel (~2 min)

1. Vercel dashboard → your project → **Settings → Domains → Add**
2. Enter your domain (e.g. `bhantesearch.org`) and the `www.` variant
3. Vercel shows DNS records to set:
   - For apex: `A` record `@ → 76.76.21.21`
   - For `www`: `CNAME www → cname.vercel-dns.com`

### 6c. Set DNS in Cloudflare (~3 min)

1. Cloudflare dashboard → your domain → **DNS → Records → Add record**
2. Add the apex `A` record:
   - Type: `A`, Name: `@`, IPv4: `76.76.21.21`
   - **Proxy status: DNS only (gray cloud, NOT orange)** — Vercel handles SSL itself; the orange cloud breaks it.
3. Add the `CNAME`:
   - Type: `CNAME`, Name: `www`, Target: `cname.vercel-dns.com`
   - Proxy status: DNS only (gray)

### 6d. Wait for DNS + SSL (~5-15 min)

Vercel polls DNS and provisions a Let's Encrypt cert. The Domains page will tick green when ready. If after 20 min it's still not green:

```bash
dig +short bhantesearch.org
# should return 76.76.21.21
```

### 6e. Update env var

Vercel dashboard → Settings → Environment Variables → edit `BETTER_AUTH_URL` to `https://bhantesearch.org`. Then **Redeploy** (Deployments → click ⋯ → Redeploy) so the new value takes effect.

Test: visit `https://bhantesearch.org` in an incognito window. Sign up. Run a search. Sign out. Sign back in.

---

## 7. Daily DB backups via GitHub Actions → Cloudflare R2 (~15 min)

The workflow file is already at `.github/workflows/db-backup.yml`. You just need to:

### 7a. Create the R2 bucket (~3 min)

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**
2. Name: `bhante-db-backups` (must be globally unique; pick a unique suffix if taken)
3. Location: Automatic
4. **Settings → Object lifecycle rules → Add rule**: delete objects older than 90 days (so backups don't accumulate forever)

### 7b. Create R2 API tokens (~3 min)

1. R2 dashboard → **Manage R2 API Tokens** → **Create API token**
2. Permission: **Object Read & Write**
3. Specify bucket: `bhante-db-backups` (so the token can't access other buckets)
4. TTL: forever (or rotate annually if you prefer)
5. Copy the three values shown — you only see them once:
   - `Access Key ID`
   - `Secret Access Key`
   - Your account ID (visible in R2 sidebar URL or settings)

### 7c. Add secrets to GitHub (~2 min)

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**. Add each:

| Secret name | Value |
|---|---|
| `NEON_DATABASE_URL` | the Neon prod connection string (Vercel env vars page) |
| `R2_ACCOUNT_ID` | your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | from step 7b |
| `R2_SECRET_ACCESS_KEY` | from step 7b |
| `R2_BUCKET` | `bhante-db-backups` |

### 7d. Trigger the first run manually (~5 min)

GitHub repo → **Actions** tab → `db-backup` workflow → **Run workflow** (workflow_dispatch button on the right). Wait ~1 min. It should complete green.

Verify in R2: dashboard → your bucket → see `backup-YYYYMMDD.sql.gz` (size: a few KB).

### 7e. Confirm the cron is scheduled

Same Actions page should show "Next run: tomorrow 04:00 UTC" or similar. From now on it runs daily, no further action needed.

---

## 8. Final sanity checks (~5 min)

- [ ] Sign up as a new test user, run a search, sign out
- [ ] Sign in again — search history should be preserved
- [ ] Pages load in <1s once warm (cold start may be 2-3s on Hobby)
- [ ] `/api/health` returns `{"status":"ok"}` without auth
- [ ] Reranker is on: search any query — results should look qualitatively better than pgvector-only (e.g. fewer borderline matches in the top 5)
- [ ] Neon dashboard shows recent compute activity
- [ ] R2 bucket has at least one backup file

If all ticked, you're live. Send the URL to testers.

---

## Recovery runbooks

### Scenario A: accidental table drop / bad data on prod

1. Neon dashboard → your project → **Branches** → **Create branch**
2. **Source**: pick "Specific point in time" → set timestamp to ~5 min before the bad query (within 6h on Free, 7d on Launch, 30d on Scale)
3. The new branch has a fresh `DATABASE_URL` — copy it
4. Verify the data is intact:
   ```bash
   psql "$BRANCH_URL" -c "select count(*) from <recovered_table>;"
   ```
5. Selectively restore to prod:
   ```bash
   pg_dump --table=<recovered_table> "$BRANCH_URL" > /tmp/restore.sql
   psql "$NEON_DATABASE_URL" -f /tmp/restore.sql
   ```
6. Delete the recovery branch in the Neon dashboard

### Scenario B: Neon outage / account locked / regional issue

1. Pull the latest dump from R2:
   ```bash
   aws s3 cp s3://bhante-db-backups/backup-$(date +%Y%m%d).sql.gz . \
     --endpoint-url=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
   ```
   (Configure aws CLI with R2 credentials first via `aws configure --profile r2`)
2. Provision new Postgres anywhere (Supabase, Fly Postgres, even local Docker for triage):
   ```bash
   docker run -d --name bhante-rescue -p 5433:5432 \
     -e POSTGRES_PASSWORD=rescue pgvector/pgvector:pg16
   ```
3. Restore the schema + irreplaceable tables:
   ```bash
   gunzip < backup-YYYYMMDD.sql.gz | psql "$NEW_URL"
   ```
4. Re-ingest chunks (chunks aren't in the backup; cheap to rebuild from `data/seminars/cleaned/` in git):
   ```bash
   DATABASE_URL="$NEW_URL" python ingest_seminars.py --reprocess
   DATABASE_URL="$NEW_URL" python ingest_epub.py --epub-path ./data/<file>.epub
   ```
5. Update Vercel `DATABASE_URL` → Redeploy. Done.

### Scenario C: bad deploy breaks the site

1. Vercel dashboard → Deployments → find the last good deployment → ⋯ menu → **Promote to Production**
2. Investigate the broken commit locally; fix; push.

---

## Costs ongoing

| Item | Monthly |
|---|---|
| Vercel Hobby | $0 |
| Neon Free | $0 (or $5 minimum on Launch when you outgrow free) |
| Cloudflare DNS / R2 | $0 (R2 free under 10 GB; backups will be MBs) |
| Domain | ~$0.83 (avg of $10/yr) |
| OpenAI embeddings (alpha traffic) | <$0.10 |
| Voyage reranker (alpha traffic) | $0 (200M tokens free) |
| **Total** | **~$1/mo** until you exceed Hobby's caps (well past M1) |

See `CLAUDE.md` for the local dev setup. See the project's CLAUDE.md "Architecture" section for code structure.
