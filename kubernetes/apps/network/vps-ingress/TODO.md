# VPS Ingress TODO

## Monitoring and Alerting

- [ ] Set up VPS monitoring
  - [ ] Install monitoring agent on VPS (Prometheus node-exporter or similar)
  - [ ] Configure scraping from home cluster Prometheus
  - [ ] Monitor: CPU, memory, disk, network usage

- [ ] Monitor WireGuard tunnel health
  - [ ] Create probe to check tunnel connectivity (ping/curl test)
  - [ ] Alert if tunnel is down
  - [ ] Monitor tunnel metrics (bandwidth, latency)

- [ ] Monitor nginx on VPS
  - [ ] Enable nginx metrics/stub_status
  - [ ] Monitor request rate, error rate, response times
  - [ ] Alert on nginx service failures

- [ ] SSL certificate monitoring
  - [ ] Monitor Let's Encrypt certificate expiry
  - [ ] Alert before certificates expire
  - [ ] Monitor certbot renewal failures

- [ ] Create Grafana dashboard
  - [ ] VPS resource usage
  - [ ] WireGuard tunnel status and metrics
  - [ ] Nginx performance metrics
  - [ ] SSL certificate status

- [ ] Configure Gatus checks
  - [ ] External HTTPS endpoint checks (plex.${SECRET_DOMAIN})
  - [ ] VPS reachability
  - [ ] WireGuard tunnel connectivity from VPS side

- [ ] Set up alerting rules
  - [ ] VPS down
  - [ ] WireGuard tunnel down
  - [ ] High VPS resource usage
  - [ ] Nginx errors
  - [ ] Certificate expiry warnings
