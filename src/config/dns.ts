import dns from 'node:dns';

/**
 * Optional DNS override for local development.
 *
 * `mongodb+srv://` URIs need a DNS SRV lookup. Some machines run a local DNS proxy
 * (VPN clients, ad blockers) on 127.0.0.1 that refuses SRV queries, which makes the
 * driver fail with `querySrv ECONNREFUSED`. Setting e.g. `DNS_SERVERS=8.8.8.8,1.1.1.1`
 * points Node's resolver at public DNS. Leave it unset in production.
 */
const servers = process.env.DNS_SERVERS?.split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (servers?.length) dns.setServers(servers);
