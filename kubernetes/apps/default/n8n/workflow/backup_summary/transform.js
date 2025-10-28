  // Process VolSync and PostgreSQL backup data from Prometheus
  const allInputs = $input.all();

  // Debug: Log what we're receiving
  const debug = {
    inputCount: allInputs.length,
    input0Structure: allInputs[0] ? Object.keys(allInputs[0]) : 'none',
    input1Structure: allInputs[1] ? Object.keys(allInputs[1]) : 'none',
    input0Json: allInputs[0]?.json ? Object.keys(allInputs[0].json) : 'none',
    input1Json: allInputs[1]?.json ? Object.keys(allInputs[1].json) : 'none'
  };

  // Debug: Check what we're receiving
  if (allInputs.length === 0) {
    return {
      error: 'No inputs received',
      debug: debug,
      total: 0,
      successful: 0,
      failed: 0,
      successRate: 0,
      successfulBackups: [],
      failedBackups: [],
      pgBackups: [],
      totalDurationSeconds: 0,
      averageDurationSeconds: 0,
      timestamp: new Date().toISOString()
    };
  }

  const firstInput = allInputs[0]?.json;
  const secondInput = allInputs[1]?.json;

  // Extract data arrays with fallback
  let volsyncData = [];
  let pgData = [];
  let durationData = [];
  let countData = [];

  // Process all inputs and detect their type automatically
  allInputs.forEach(input => {
    let json = input?.json;
    if (!json) return;

    // Handle case where data is wrapped in an array [{ status: "success", data: {...} }]
    // Keep unwrapping until we get to the actual object
    while (Array.isArray(json) && json.length > 0) {
      json = json[0];
    }

    // Check if this is Prometheus format (VolSync data)
    if (json.data?.result) {
      const result = json.data.result;

      if (result.length > 0) {
        const metricName = result[0].metric?.__name__;

        // Check if it has VolSync out_of_sync metrics
        if (metricName === 'volsync_volume_out_of_sync') {
          volsyncData = result;
        }
        // Check if it has VolSync duration metrics
        else if (metricName === 'volsync_sync_duration_seconds_sum') {
          durationData = result;
        }
        // Check if it has VolSync count metrics
        else if (metricName === 'volsync_sync_duration_seconds_count') {
          countData = result;
        }
        // Check if it has PostgreSQL metrics (already formatted)
        else if (result[0].metric?.cluster) {
          pgData = result;
        }
      }
    }

    // Check if this is raw K8s API format (PostgreSQL backup data)
    if (json.items && json.kind === 'BackupList') {
      // Transform K8s API response to Prometheus-like format
      if (json.items.length > 0) {
        // Get backups from last 48 hours
        const now = new Date();
        const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

        const recentBackups = json.items.filter(item => {
          const createdAt = new Date(item.metadata.creationTimestamp);
          return createdAt >= twoDaysAgo;
        });

        // If no recent backups, just take the latest one
        const backupsToProcess = recentBackups.length > 0 ? recentBackups : [json.items[json.items.length - 1]];

        // Convert each backup to Prometheus-like format
        pgData = backupsToProcess.map(backup => {
          const phase = backup.status?.phase || 'unknown';
          const statusValue = phase === 'completed' ? '1' : '0';

          return {
            metric: {
              cluster: backup.spec.cluster.name,
              namespace: backup.metadata.namespace,
              backupName: backup.metadata.name
            },
            value: [
              Math.floor(new Date(backup.metadata.creationTimestamp).getTime() / 1000).toString(),
              statusValue
            ]
          };
        });
      }
    }
  });

  // If no data found, return empty summary
  if (volsyncData.length === 0 && pgData.length === 0) {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      successRate: 0,
      successfulBackups: [],
      failedBackups: [],
      pgBackups: [],
      totalDurationSeconds: 0,
      averageDurationSeconds: 0,
      timestamp: new Date().toISOString()
    };
  }

  // Create lookup maps for duration and count data
  const durationMap = {};
  const countMap = {};

  durationData.forEach(item => {
    const key = `${item.metric.obj_namespace}/${item.metric.obj_name}`;
    durationMap[key] = parseFloat(item.value[1]);
  });

  countData.forEach(item => {
    const key = `${item.metric.obj_namespace}/${item.metric.obj_name}`;
    countMap[key] = parseFloat(item.value[1]);
  });

  // Initialize counters and arrays
  let successfulBackups = [];
  let failedBackups = [];
  let pgBackups = [];

  // Process VolSync backups
  volsyncData.forEach(item => {
    const namespace = item.metric.obj_namespace;
    const name = item.metric.obj_name;
    const method = item.metric.method || 'restic';
    const isOutOfSync = parseInt(item.value[1]) === 1;

    const backup = {
      name: name,
      namespace: namespace,
      method: method,
      type: 'volsync',
      status: isOutOfSync ? 'failed' : 'success'
    };

    if (isOutOfSync) {
      failedBackups.push(backup);
    } else {
      successfulBackups.push(backup);
    }
  });

  // Process PostgreSQL backups
  // Note: status value "1" = completed/success, "0" = failed
  // Group by cluster and take the latest backup for each cluster
  const clusterLatestBackups = {};

  pgData.forEach(item => {
    const cluster = item.metric.cluster;
    const timestamp = parseInt(item.value[0]);

    // Keep only the latest backup for each cluster
    if (!clusterLatestBackups[cluster] || timestamp > clusterLatestBackups[cluster].timestamp) {
      clusterLatestBackups[cluster] = {
        cluster: cluster,
        namespace: item.metric.namespace || 'database',
        backupName: item.metric.backupName,
        statusValue: parseInt(item.value[1]),
        timestamp: timestamp
      };
    }
  });

  // Convert to backup objects
  Object.values(clusterLatestBackups).forEach(item => {
    const isSuccess = item.statusValue === 1;

    const backup = {
      name: item.cluster,
      namespace: item.namespace,
      method: 'postgres',
      type: 'postgres',
      status: isSuccess ? 'success' : 'failed'
    };

    pgBackups.push(backup);

    if (isSuccess) {
      successfulBackups.push(backup);
    } else {
      failedBackups.push(backup);
    }
  });

  // Calculate duration statistics for VolSync backups only (exclude restore destinations)
  let totalDuration = 0;
  let backupsWithDuration = 0;

  // Loop through durationData instead of volsyncData
  durationData.forEach(item => {
    // Only count source backups (not restore destinations)
    if (item.metric.role === 'source') {
      const key = `${item.metric.obj_namespace}/${item.metric.obj_name}`;
      const totalSeconds = parseFloat(item.value[1]); // Total cumulative duration
      const count = countMap[key]; // Total number of runs

      if (totalSeconds && count && count > 0) {
        // Calculate average duration per run for this backup
        const avgDurationForThisBackup = totalSeconds / count;

        // Only include reasonable durations (less than 2 hours per backup)
        // This filters out corrupted/stuck backup metrics
        if (avgDurationForThisBackup < 7200) {
          totalDuration += avgDurationForThisBackup;
          backupsWithDuration++;
        }
      }
    }
  });

  const averageDurationSeconds = backupsWithDuration > 0 ? totalDuration / backupsWithDuration : 0;

  // Calculate summary statistics
  const totalBackups = successfulBackups.length + failedBackups.length;
  const successRate = totalBackups > 0 ? Math.round((successfulBackups.length / totalBackups) * 100) : 0;

  // Create summary object
  const summary = {
    total: totalBackups,
    successful: successfulBackups.length,
    failed: failedBackups.length,
    successRate: successRate,
    successfulBackups: successfulBackups.sort((a, b) => a.name.localeCompare(b.name)),
    failedBackups: failedBackups.sort((a, b) => a.name.localeCompare(b.name)),
    pgBackups: pgBackups,
    totalDurationSeconds: totalDuration,
    averageDurationSeconds: averageDurationSeconds,
    timestamp: new Date().toISOString()
  };

  return summary;
