  // Process VolSync and PostgreSQL backup data from Prometheus
  const volsyncData = $input.first().json.data.result || [];
  const pgData = $input.all()[1]?.json?.data?.result || [];

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
  pgData.forEach(item => {
    const cluster = item.metric.cluster;
    const namespace = item.metric.namespace || 'database';
    const status = parseInt(item.value[1]);
    const isFailed = status === 0;

    const backup = {
      name: cluster,
      namespace: namespace,
      method: 'postgres',
      type: 'postgres',
      status: isFailed ? 'failed' : 'success'
    };

    pgBackups.push(backup);

    if (isFailed) {
      failedBackups.push(backup);
    } else {
      successfulBackups.push(backup);
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
