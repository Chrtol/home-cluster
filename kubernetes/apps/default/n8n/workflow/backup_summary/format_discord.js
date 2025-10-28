// Enhanced Discord formatting - with PostgreSQL category
  const data = $json;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create progress bar
  function createProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  // Group backups by namespace (excluding postgres)
  const namespaces = {};
  [...data.successfulBackups, ...data.failedBackups].filter(b => b.type !== 'postgres').forEach(backup => {
    if (!namespaces[backup.namespace]) {
      namespaces[backup.namespace] = { successful: [], failed: [] };
    }
    if (backup.status === 'success') {
      namespaces[backup.namespace].successful.push(backup);
    } else {
      namespaces[backup.namespace].failed.push(backup);
    }
  });

  // Status emoji and color
  let statusEmoji = '🟢';
  let embedColor = 0x00ff00;
  if (data.successRate < 90) { statusEmoji = '🟡'; embedColor = 0xffff00; }
  if (data.successRate < 70) { statusEmoji = '🔴'; embedColor = 0xff0000; }

  // Build PostgreSQL section first
  let postgresText = "";
  if (data.pgBackups && data.pgBackups.length > 0) {
    const pgSuccess = data.pgBackups.filter(b => b.status === 'success').length;
    const pgTotal = data.pgBackups.length;
    const pgEmoji = pgSuccess === pgTotal ? '✅' : pgSuccess > 0 ? '⚠️' : '❌';

    postgresText = `\n**🗄️ POSTGRESQL** (${pgSuccess}/${pgTotal} ${pgEmoji})\n`;

    data.pgBackups.forEach(backup => {
      const emoji = backup.status === 'success' ? '✅' : '❌';
      postgresText += `\`${emoji} ${backup.name}\`\n`;
    });
  }

  // Build namespace sections
  let namespaceText = "";
  Object.keys(namespaces).sort().forEach(ns => {
    const nsData = namespaces[ns];
    const nsTotal = nsData.successful.length + nsData.failed.length;
    const nsSuccess = nsData.successful.length;
    const nsEmoji = nsSuccess === nsTotal ? '✅' : nsSuccess > 0 ? '⚠️' : '❌';

    const nsEmojis = {
      'default': '🏠',
      'media': '🎬',
      'database': '🗄️',
      'observability': '📊'
    };
    const nsIcon = nsEmojis[ns] || '📁';

    namespaceText += `\n**${nsIcon} ${ns.toUpperCase()}** (${nsSuccess}/${nsTotal} ${nsEmoji})\n`;

    // Shorter backup lists - break into multiple lines if needed
    if (nsData.successful.length > 0) {
      const successNames = nsData.successful.map(b => `✅ ${b.name}`);
      for (let i = 0; i < successNames.length; i += 2) {
        const chunk = successNames.slice(i, i + 2).join('  ');
        namespaceText += `\`${chunk}\`\n`;
      }
    }

    if (nsData.failed.length > 0) {
      const failNames = nsData.failed.map(b => `❌ ${b.name}`);
      for (let i = 0; i < failNames.length; i += 2) {
        const chunk = failNames.slice(i, i + 2).join('  ');
        namespaceText += `\`${chunk}\`\n`;
      }
    }
  });

  // Attention section
  let attentionText = "";
  if (data.failedBackups.length > 0) {
    attentionText = "\n**🚨 ATTENTION NEEDED**\n";
    data.failedBackups.forEach(backup => {
      attentionText += `❌ **${backup.name}** (${backup.type})\n`;
    });
  }

  // Calculate separate counts for VolSync and PostgreSQL
  const volsyncSuccessful = data.successfulBackups.filter(b => b.type !== 'postgres').length;
  const volsyncFailed = data.failedBackups.filter(b => b.type !== 'postgres').length;
  const volsyncTotal = volsyncSuccessful + volsyncFailed;
  const pgSuccessful = data.pgBackups ? data.pgBackups.filter(b => b.status === 'success').length : 0;
  const pgFailed = data.pgBackups ? data.pgBackups.filter(b => b.status === 'failed').length : 0;

  // Format duration from seconds to readable format
  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  }

  const avgDuration = data.averageDurationSeconds ? formatDuration(data.averageDurationSeconds) : 'N/A';

  // Main description
  const progressBar = createProgressBar(data.successRate);
  const description = `${progressBar} ${data.successRate}% Success Rate

  **📊 SUMMARY**
  \`\`\`
  VolSync:    ✅ ${volsyncSuccessful} Successful  ❌ ${volsyncFailed} Failed
              🕐 ${avgDuration} avg
  PostgreSQL: ✅ ${pgSuccessful} Successful  ❌ ${pgFailed} Failed
  \`\`\`
  ${postgresText}${namespaceText}${attentionText}`;

  // Create the embed
  const embed = {
    title: `${statusEmoji} **Daily Backup Report** - ${dateStr}`,
    description: description,
    color: embedColor,
    timestamp: now.toISOString(),
    footer: {
      text: "Backup Monitor • Next report tomorrow 8:00 AM"
    }
  };

  return {
    embeds: [embed]
  };
