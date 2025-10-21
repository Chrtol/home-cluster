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
      timestamp: new Date().toISOString()
    };
  }

  const firstInput = allInputs[0]?.json;
  const secondInput = allInputs[1]?.json;

  // Extract data arrays with fallback
  let volsyncData = [];
  let pgData = [];

  // Process all inputs and detect their type automatically
  allInputs.forEach(input => {
    const json = input?.json;
    if (!json) return;

    // Check if this is Prometheus format (VolSync data)
    if (json.data?.result) {
      const result = json.data.result;
      // Check if it has VolSync metrics
      if (result.length > 0 && result[0].metric?.obj_namespace) {
        volsyncData = result;
      }
      // Check if it has PostgreSQL metrics (already formatted)
      else if (result.length > 0 && result[0].metric?.cluster) {
        pgData = result;
      }
    }

    // Check if this is raw K8s API format (PostgreSQL backup data)
    if (json.items && json.kind === 'BackupList') {
      // Transform K8s API response to Prometheus-like format
      if (json.items.length > 0) {
        const sorted = json.items.sort((a, b) =>
          a.metadata.creationTimestamp.localeCompare(b.metadata.creationTimestamp)
        );
        const latest = sorted[sorted.length - 1];
        const phase = latest.status?.phase || 'unknown';
        const statusValue = phase === 'completed' ? '1' : '0';

        pgData = [{
          metric: {
            cluster: latest.spec.cluster.name,
            namespace: latest.metadata.namespace
          },
          value: [
            Math.floor(Date.now() / 1000).toString(),
            statusValue
          ]
        }];
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
      timestamp: new Date().toISOString()
    };
  }

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
  pgData.forEach(item => {
    const cluster = item.metric.cluster;
    const namespace = item.metric.namespace || 'database';
    const statusValue = parseInt(item.value[1]);
    const isSuccess = statusValue === 1;

    const backup = {
      name: cluster,
      namespace: namespace,
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
    timestamp: new Date().toISOString()
  };

  return summary;
