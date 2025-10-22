/**
 * Reset Cron Jobs
 *
 * Three lightweight cron jobs that reset leaderboard stats at the start of each period:
 * - Daily: Runs at midnight UTC (00:00)
 * - Weekly: Runs at midnight UTC on Monday (00:00)
 * - Monthly: Runs at midnight UTC on the 1st of each month (00:00)
 *
 * Each job simply deletes all records from the corresponding stat collection.
 * No history is kept - just a clean reset for each new period.
 *
 * Uses UTC timezone for consistency.
 */

const cron = require('node-cron');
const DailyStat = require('../models/DailyStat');
const WeeklyStat = require('../models/WeeklyStat');
const MonthlyStat = require('../models/MonthlyStat');

/**
 * Reset daily stats at midnight UTC
 */
async function resetDailyStats() {
  try {
    console.log('[Reset Job] Resetting daily stats...');
    const result = await DailyStat.deleteMany({});
    console.log(`[Reset Job] Deleted ${result.deletedCount} daily stat records`);
  } catch (error) {
    console.error('[Reset Job] Error resetting daily stats:', error);
  }
}

/**
 * Reset weekly stats at Monday midnight UTC
 */
async function resetWeeklyStats() {
  try {
    console.log('[Reset Job] Resetting weekly stats...');
    const result = await WeeklyStat.deleteMany({});
    console.log(`[Reset Job] Deleted ${result.deletedCount} weekly stat records`);
  } catch (error) {
    console.error('[Reset Job] Error resetting weekly stats:', error);
  }
}

/**
 * Reset monthly stats on the 1st of each month at midnight UTC
 */
async function resetMonthlyStats() {
  try {
    console.log('[Reset Job] Resetting monthly stats...');
    const result = await MonthlyStat.deleteMany({});
    console.log(`[Reset Job] Deleted ${result.deletedCount} monthly stat records`);
  } catch (error) {
    console.error('[Reset Job] Error resetting monthly stats:', error);
  }
}

/**
 * Initialize and start all reset cron jobs
 */
function startResetJobs() {
  // Daily reset - runs at midnight UTC every day
  // Cron: 0 0 * * * (second minute hour day month weekday)
  const dailyJob = cron.schedule('0 0 * * *', resetDailyStats, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Weekly reset - runs at midnight UTC every Monday
  // Cron: 0 0 * * 1 (Monday is day 1)
  const weeklyJob = cron.schedule('0 0 * * 1', resetWeeklyStats, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Monthly reset - runs at midnight UTC on the 1st of each month
  // Cron: 0 0 1 * * (1st day of month)
  const monthlyJob = cron.schedule('0 0 1 * *', resetMonthlyStats, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log('[Reset Jobs] Scheduled successfully:');
  console.log('  - Daily: Every day at 00:00 UTC');
  console.log('  - Weekly: Every Monday at 00:00 UTC');
  console.log('  - Monthly: Every 1st of month at 00:00 UTC');

  return { dailyJob, weeklyJob, monthlyJob };
}

module.exports = { startResetJobs, resetDailyStats, resetWeeklyStats, resetMonthlyStats };
