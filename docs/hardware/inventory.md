# Hardware Inventory

## Infrastructure Overview

The homelab consists of a Proxmox virtualization cluster hosting the Kubernetes nodes, with dedicated storage and networking infrastructure. All hardware is optimized for 24/7 operation with redundancy and high availability.

## Proxmox Infrastructure

### Proxmox Cluster
- **High Availability**: Keepalived + HAProxy for automatic failover
- **Domain**: `proxmox.example.com` (points to all nodes)
- **Management**: Centralized management through HA proxy
- **Storage**: Ceph distributed storage across nodes
- **Networking**: Redundant network paths with automatic failover

### Proxmox Node Configuration
*Note: Specific hardware details to be added based on actual Proxmox nodes*

| Node | Role | Hardware | Storage | Network |
|------|------|----------|---------|---------|
| pve1 | Proxmox Host | *TBD* | *TBD* | *TBD* |
| pve2 | Proxmox Host | *TBD* | *TBD* | *TBD* |
| pve3 | Proxmox Host | *TBD* | *TBD* | *TBD* |

## Kubernetes Nodes

### Node Specifications

#### lenovo1 (10.0.30.100)
- **Model**: Lenovo ThinkCentre M910Q
- **Role**: Controller + Worker
- **CPU**: Intel Core i7-7700T @ 2.90GHz
- **Memory**: 32GB DDR4 RAM
- **Storage**: Local SSD for OS and Ceph
- **Network**: Gigabit Ethernet
- **MAC Address**: bc:24:11:db:44:3d
- **Disk**: /dev/sda

#### lenovo2 (10.0.30.101)
- **Model**: Lenovo ThinkCentre M910Q
- **Role**: Controller + Worker
- **CPU**: Intel Core i7-7700T @ 2.90GHz
- **Memory**: 32GB DDR4 RAM
- **Storage**: Local SSD for OS and Ceph
- **Network**: Gigabit Ethernet
- **MAC Address**: bc:24:11:11:70:d8
- **Disk**: /dev/sda

#### dell1 (10.0.30.102)
- **Model**: Dell OptiPlex 3080
- **Role**: Controller + Worker
- **CPU**: Intel Core i7-12700T @ 3.6GHz (12th Gen)
- **Memory**: 64GB DDR4 RAM
- **Storage**: Local SSD for OS and Ceph
- **Network**: Gigabit Ethernet
- **MAC Address**: bc:24:11:c5:fc:46
- **Disk**: /dev/sda

### Node Characteristics
- **Operating System**: Talos Linux v1.9.0
- **Kubernetes**: v1.31.4
- **Container Runtime**: containerd
- **Network**: Cilium CNI with eBPF
- **Storage**: Ceph RBD and CephFS CSI drivers

## Storage Infrastructure

### TrueNAS Server
- **Model**: Aoostar WTR Pro
- **CPU**: Intel N150
- **Memory**: 16GB DDR4 (upgrading to 32GB)
- **Network**: 2x 2.5GbE (planning link aggregation)
- **IP Address**: 10.0.30.10
- **Hostname**: nas.example.com

#### Storage Configuration
- **Storage Pool**: 4x 12TB HDDs in RAIDZ1
- **Usable Capacity**: 36TB (75% efficiency)
- **Cache**: 256GB NVMe L2ARC cache
- **Performance**: Optimized for media streaming and backup storage
- **Redundancy**: Single disk failure tolerance

#### Drive Layout
| Position | Drive | Capacity | Type | Purpose |
|----------|-------|----------|------|---------|
| Bay 1 | 12TB HDD | 12TB | SATA | RAIDZ1 Pool |
| Bay 2 | 12TB HDD | 12TB | SATA | RAIDZ1 Pool |
| Bay 3 | 12TB HDD | 12TB | SATA | RAIDZ1 Pool |
| Bay 4 | 12TB HDD | 12TB | SATA | RAIDZ1 Pool |
| M.2 Slot | NVMe SSD | 256GB | NVMe | L2ARC Cache |

#### Network Configuration
- **Port 1**: 2.5GbE (Active)
- **Port 2**: 2.5GbE (Planned for aggregation)
- **Total Bandwidth**: 2.5Gbps current, 5Gbps planned

## Network Infrastructure

### Network Topology
- **Primary Network**: 10.0.30.0/24
- **Gateway**: 10.0.30.1
- **DNS**: 10.0.30.1 (Primary), 9.9.9.9 (Secondary)
- **DHCP**: Router-managed for general devices
- **Static IPs**: Kubernetes infrastructure uses static assignments

### Network Equipment
*Note: Specific router/switch details to be documented*

| Device | Model | Role | IP Address | Features |
|--------|-------|------|------------|----------|
| Router | Topton N150 | Gateway/BGP Peer | 10.0.30.1 | BGP AS 64513, 8GB RAM |
| Switch | Netgear 16-port | Core Switch | N/A | 1Gbps, planning 10G upgrade |

### BGP Configuration
- **Router ASN**: 64513
- **Cluster ASN**: 64514
- **Peering**: BGP peering for load balancer IP advertisement
- **Failover**: Automatic failover via BGP convergence

## Power and Environmental

### Power Management
- **UPS**: *TBD* - Battery backup for critical infrastructure
- **Power Draw**: *TBD* - Total power consumption
- **Efficiency**: Optimized for 24/7 operation

### Environmental Monitoring
- **Temperature**: Monitored via hardware sensors
- **Humidity**: *TBD* - Environmental monitoring
- **Cooling**: *TBD* - Cooling solution details

## Monitoring and Management

### Hardware Monitoring
- **IPMI/BMC**: Out-of-band management where available
- **Temperature**: CPU and system temperature monitoring
- **Power**: Power consumption monitoring
- **Storage**: Drive health monitoring via SMART

### Monitoring Integration
- **Prometheus**: Hardware metrics collection
- **Grafana**: Hardware dashboards and visualization
- **Alerting**: Critical hardware failure notifications
- **SNMP**: Network device monitoring

## Expansion Planning

### Planned Upgrades

#### TrueNAS Enhancements
- **Memory**: Upgrade from 16GB to 32GB DDR4
- **Network**: Configure link aggregation for 5Gbps throughput
- **Storage**: Potential expansion with additional drive bays

#### Kubernetes Cluster Growth
- **Additional Nodes**: Template-based configuration for easy expansion
- **Storage Expansion**: Ceph cluster scaling with additional OSDs
- **Network**: Additional network interfaces for dedicated storage network

### Capacity Planning
- **Compute**: Current resource utilization and growth projections
- **Storage**: Storage growth trends and expansion requirements
- **Network**: Bandwidth utilization and upgrade planning

## Maintenance and Support

### Maintenance Schedule
- **Monthly**: Hardware health checks and cleaning
- **Quarterly**: Drive health analysis and replacement planning
- **Annually**: Complete system audit and upgrade planning

### Hardware Lifecycle
- **Warranty**: Track warranty status for all components
- **Replacement**: Proactive replacement before failure
- **Disposal**: Secure disposal of end-of-life hardware

### Spare Parts
- **Critical Spares**: Spare drives and network components
- **Replacement Plan**: Rapid replacement procedures
- **Vendor Contacts**: Support contact information

## Security Considerations

### Physical Security
- **Access Control**: Restricted access to hardware
- **Secure Boot**: UEFI secure boot where supported
- **Disk Encryption**: Encryption capabilities evaluation

### Network Security
- **Network Segmentation**: Isolated management networks
- **Access Control**: Network ACLs and firewall rules
- **Monitoring**: Network traffic monitoring and analysis

---

**Last Updated**: 2025-07-16  
**Inventory Version**: v1.0  
**Next Audit**: 2025-10-16

*Note: This inventory requires completion with specific hardware details for Proxmox nodes and network equipment. Please update with actual specifications as available.*