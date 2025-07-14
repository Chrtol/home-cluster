# TrueNAS Storage Migration and Performance Optimization

**Date:** July 14, 2025

## Overview
Migrated from 2-disk mirror (12TB usable) to 4-disk RAIDZ1 (36TB usable) and added NVMe L2ARC cache for performance optimization.

## Hardware Setup
- **NAS:** Aoostar WTR Pro with Intel N150
- **Storage:** 4x 12TB HDDs in RAIDZ1 configuration
- **Cache:** 256GB NVMe M.2 2280 (via WiFi slot + adapter)
- **RAM:** 16GB (planning upgrade to 32GB)
- **Networking:** 2x 2.5GbE (currently using 1 port, planning VPC/LAG configuration)

## Migration Process

### Phase 1: Pre-Migration Analysis
- Confirmed hybrid storage architecture:
  - **Kubernetes configs:** Stored in Ceph RBD (safe from migration)
  - **Media files:** Stored on TrueNAS NFS (will be lost in conversion)
- No backup required for application configurations
- Only media files needed to be re-downloaded

### Phase 2: Storage Conversion
1. **Exported existing 2-disk mirror pool**
   - Used "Export/Disconnect" without destroying data
   - Deleted saved configurations to clean up TrueNAS config

2. **Created new RAIDZ1 pool**
   - **Pool Type:** RAIDZ1 with 4x 12TB drives
   - **Usable Space:** 36TB (3x drive capacity)
   - **Redundancy:** Single disk failure tolerance
   - **Additional options:** All disabled (log, spare, cache, metadata, dedup)

3. **Recreated storage structure**
   - **Pool Name:** `truenas`
   - **Dataset:** `data` with Generic share type (for media-related data)
   - **Subfolders:** `media/`, `downloads/`, `backups/`
   - **Permissions:** POSIX_OPEN preset with kubernetes user access

### Phase 3: NFS Share Configuration
1. **Created NFS export**
   - **Share Name:** `cf-nas`
   - **Path:** `/mnt/truenas/cf-nas`
   - **Networks:** Kubernetes cluster network (10.0.30.0/24)
   - **Maproot:** kubernetes user (UID 1000)
   - **Options:** All Directories enabled

2. **Resolved connectivity issues**
   - Fixed "stale file handle" errors by restarting Kubernetes pods
   - All media applications automatically reconnected to new NFS share

### Phase 4: Performance Optimization

#### L2ARC Cache Installation
1. **Hardware:** Installed 256GB NVMe M.2 2280 drive
   - Used WiFi slot with included M.2 to NVMe adapter
   - Drive secured via adapter, resting against case (adequate for stationary NAS)

2. **Cache Configuration**
   - Added NVMe as L2ARC cache to existing RAIDZ1 pool
   - Cache type: Single drive (no redundancy needed)
   - "Treat disk size as minimum": Disabled (correct for cache)

#### ZFS Tuning Attempts
- Investigated ZFS performance tunables for TrueNAS SCALE
- Found that SCALE uses Linux ZFS module parameters vs FreeBSD sysctls
- Determined manual tuning unnecessary due to good SCALE defaults
- Confirmed prefetch already enabled (`zfs_prefetch_disable = 0`)

## Results and Benefits

### Storage Improvements
- **Capacity:** Increased from 12TB to 36TB usable (3x improvement)
- **RAID Level:** RAIDZ1 provides good balance of capacity and redundancy
- **Cost Efficiency:** Maximum usable space from 4 drives for media storage

### Performance Enhancements
- **L2ARC Cache:** 256GB NVMe provides fast access to frequently used files
- **Optimized for Media:** Large sequential reads benefit from ZFS prefetch
- **Network Ready:** Dual 2.5GbE supports high bandwidth streaming

### Application Recovery
- **Zero Configuration Loss:** All *arr apps (Sonarr, Radarr, Prowlarr, etc.) retained settings
- **Automatic Detection:** Apps detected missing media and began re-downloading
- **Seamless Operation:** Total downtime ~30 minutes for storage conversion

## Future Improvements

### Planned Upgrades
1. **RAM Expansion:** Upgrade from 16GB to 32GB
   - Will allow ~24GB ZFS ARC cache
   - Improved metadata caching and system responsiveness

2. **Network Aggregation:** Configure VPC/LAG with 2x 2.5GbE
   - Currently using single 2.5GbE port
   - Theoretical 5Gbps throughput for multiple concurrent streams when both ports active
   - Individual connections limited to 2.5Gbps (still excellent for 4K media)

### Monitoring Recommendations
- **L2ARC Usage:** Monitor via `/proc/spl/kstat/zfs/arcstats | grep l2`
- **Disk Activity:** Check NVMe utilization in TrueNAS Reporting
- **Pool Health:** Regular scrubs and status monitoring

## Architecture Summary

**Final Configuration:**
- **Storage:** 36TB RAIDZ1 (4x 12TB HDDs)
- **Cache:** 256GB NVMe L2ARC
- **Memory:** 16GB RAM (ZFS ARC ~13GB)
- **Network:** 2x 2.5GbE (currently using 1 port)
- **Redundancy:** Single disk failure protection

**Performance Characteristics:**
- **Large Media Files:** Excellent with ZFS prefetch and L2ARC
- **Concurrent Users:** Dual network paths support multiple streams
- **Cache Hit Rate:** NVMe cache improves frequently accessed content
- **Capacity Efficiency:** 75% storage efficiency (3 of 4 drives usable)

This configuration provides an optimal balance of capacity, performance, and cost-effectiveness for a homelab media server environment.