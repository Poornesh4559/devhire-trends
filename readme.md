cd devhire-trends
npm install
wrangler d1 create devhire-db
# paste database_id into wrangler.toml
wrangler kv:namespace create METADATA
# paste id into wrangler.toml
wrangler secret put SCRAPE_SECRET  = nothing
wrangler d1 migrations apply devhire-db --local
npm run dev