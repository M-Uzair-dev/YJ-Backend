/**
 * Leaderboard Cron Jobs
 *
 * Three separate jobs that recalculate leaderboard stats for COMPLETED periods:
 * - Daily: Runs at midnight every day (calculates YESTERDAY's stats)
 * - Weekly: Runs at midnight every Monday (calculates PREVIOUS WEEK Mon-Sun)
 * - Monthly: Runs at midnight on the 1st of each month (calculates PREVIOUS MONTH)
 *
 * Each job:
 * 1. Calculates the completed period date range
 * 2. Aggregates all transactions for each user within that period
 * 3. Removes old stats (keeps only the most recent period)
 * 4. Creates new stat entries with the calculated totals
 *
 * Calculation logic:
 * - Direct income and passive income: add to total
 * - Withdrawals: subtract from total
 *
 * Uses UTC timezone for consistency across all period calculations.
 * Routes fetch the most recent stats (by sorting on date descending).
 */

const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const DailyStat = require('../models/DailyStat');
const WeeklyStat = require('../models/WeeklyStat');
const MonthlyStat = require('../models/MonthlyStat');

/**
 * Calculate daily stats - YESTERDAY's completed 24 hours
 */
async function calculateDailyStats() {
  try {
    console.log('[Daily Stats] Starting calculation...');

    const now = new Date();

    // Calculate YESTERDAY's date range
    const startOfYesterday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1,
      0, 0, 0, 0
    ));

    const endOfYesterday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));

    console.log(`[Daily Stats] Calculating for: ${startOfYesterday.toISOString()} to ${endOfYesterday.toISOString()}`);

    // Aggregate transactions from yesterday grouped by user
    const dailyTotals = await Transaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfYesterday,
            $lt: endOfYesterday
          },
          type: { $in: ['direct', 'passive', 'withdrawal'] }
        }
      },
      {
        $group: {
          _id: '$user_id',
          total: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'withdrawal'] },
                { $multiply: ['$amount', -1] }, // Negative for withdrawals
                '$amount' // Positive for direct and passive
              ]
            }
          }
        }
      }
    ]);

    // Clean up old daily stats (keep only the most recent 7 days to save space)
    const sevenDaysAgo = new Date(startOfYesterday);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    await DailyStat.deleteMany({ date: { $lt: sevenDaysAgo } });

    // Remove yesterday's old stats if they exist (for recalculation)
    await DailyStat.deleteMany({ date: startOfYesterday });

    // Insert new daily stats
    if (dailyTotals.length > 0) {
      const dailyStats = dailyTotals.map(item => ({
        userId: item._id,
        total: item.total,
        date: startOfYesterday
      }));

      await DailyStat.insertMany(dailyStats);
      console.log(`[Daily Stats] Calculated stats for ${dailyStats.length} users for ${startOfYesterday.toISOString().split('T')[0]}`);
    } else {
      console.log('[Daily Stats] No transactions found for yesterday');
    }

    console.log('[Daily Stats] Calculation completed successfully');
  } catch (error) {
    console.error('[Daily Stats] Error calculating stats:', error);
  }
}

/**
 * Calculate weekly stats - PREVIOUS WEEK (Monday to Sunday)
 */
async function calculateWeeklyStats() {
  try {
    console.log('[Weekly Stats] Starting calculation...');

    const now = new Date();

    // Calculate PREVIOUS WEEK's date range (Monday to Sunday)
    // Today is Monday (day 1), so previous Monday is 7 days ago
    const startOfLastWeek = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 7,
      0, 0, 0, 0
    ));

    const endOfLastWeek = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));

    console.log(`[Weekly Stats] Calculating for: ${startOfLastWeek.toISOString()} to ${endOfLastWeek.toISOString()}`);

    // Aggregate transactions from last week grouped by user
    const weeklyTotals = await Transaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfLastWeek,
            $lt: endOfLastWeek
          },
          type: { $in: ['direct', 'passive', 'withdrawal'] }
        }
      },
      {
        $group: {
          _id: '$user_id',
          total: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'withdrawal'] },
                { $multiply: ['$amount', -1] },
                '$amount'
              ]
            }
          }
        }
      }
    ]);

    // Clean up old weekly stats (keep only the most recent 4 weeks)
    const fourWeeksAgo = new Date(startOfLastWeek);
    fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28);
    await WeeklyStat.deleteMany({ date: { $lt: fourWeeksAgo } });

    // Remove last week's old stats if they exist (for recalculation)
    await WeeklyStat.deleteMany({ date: startOfLastWeek });

    // Insert new weekly stats
    if (weeklyTotals.length > 0) {
      const weeklyStats = weeklyTotals.map(item => ({
        userId: item._id,
        total: item.total,
        date: startOfLastWeek
      }));

      await WeeklyStat.insertMany(weeklyStats);
      console.log(`[Weekly Stats] Calculated stats for ${weeklyStats.length} users for week starting ${startOfLastWeek.toISOString().split('T')[0]}`);
    } else {
      console.log('[Weekly Stats] No transactions found for last week');
    }

    console.log('[Weekly Stats] Calculation completed successfully');
  } catch (error) {
    console.error('[Weekly Stats] Error calculating stats:', error);
  }
}

/**
 * Calculate monthly stats - PREVIOUS MONTH
 */
async function calculateMonthlyStats() {
  try {
    console.log('[Monthly Stats] Starting calculation...');

    const now = new Date();

    // Calculate PREVIOUS MONTH's date range
    const startOfLastMonth = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - 1,
      1,
      0, 0, 0, 0
    ));

    const startOfCurrentMonth = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
      0, 0, 0, 0
    ));

    console.log(`[Monthly Stats] Calculating for: ${startOfLastMonth.toISOString()} to ${startOfCurrentMonth.toISOString()}`);

    // Aggregate transactions from last month grouped by user
    const monthlyTotals = await Transaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfLastMonth,
            $lt: startOfCurrentMonth
          },
          type: { $in: ['direct', 'passive', 'withdrawal'] }
        }
      },
      {
        $group: {
          _id: '$user_id',
          total: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'withdrawal'] },
                { $multiply: ['$amount', -1] },
                '$amount'
              ]
            }
          }
        }
      }
    ]);

    // Clean up old monthly stats (keep only the most recent 12 months)
    const twelveMonthsAgo = new Date(Date.UTC(
      startOfLastMonth.getUTCFullYear(),
      startOfLastMonth.getUTCMonth() - 12,
      1,
      0, 0, 0, 0
    ));
    await MonthlyStat.deleteMany({ date: { $lt: twelveMonthsAgo } });

    // Remove last month's old stats if they exist (for recalculation)
    await MonthlyStat.deleteMany({ date: startOfLastMonth });

    // Insert new monthly stats
    if (monthlyTotals.length > 0) {
      const monthlyStats = monthlyTotals.map(item => ({
        userId: item._id,
        total: item.total,
        date: startOfLastMonth
      }));

      await MonthlyStat.insertMany(monthlyStats);
      console.log(`[Monthly Stats] Calculated stats for ${monthlyStats.length} users for ${startOfLastMonth.toISOString().split('T')[0]}`);
    } else {
      console.log('[Monthly Stats] No transactions found for last month');
    }

    console.log('[Monthly Stats] Calculation completed successfully');
  } catch (error) {
    console.error('[Monthly Stats] Error calculating stats:', error);
  }
}

/**
 * Initialize and start all leaderboard cron jobs
 */
function startLeaderboardJob() {
  // Daily job: Runs at midnight every day (0 0 * * *)
  // Calculates yesterday's stats
  const dailyJob = cron.schedule('0 0 * * *', calculateDailyStats, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Weekly job: Runs at midnight every Monday (0 0 * * 1)
  // Calculates previous week's stats (Mon-Sun)
  const weeklyJob = cron.schedule('0 0 * * 1', calculateWeeklyStats, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Monthly job: Runs at midnight on the 1st of each month (0 0 1 * *)
  // Calculates previous month's stats
  const monthlyJob = cron.schedule('0 0 1 * *', calculateMonthlyStats, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log('[Leaderboard Jobs] Scheduled:');
  console.log('  - Daily: Midnight every day (calculates yesterday)');
  console.log('  - Weekly: Midnight every Monday (calculates previous week Mon-Sun)');
  console.log('  - Monthly: Midnight on 1st of each month (calculates previous month)');

  // Run all calculations immediately on startup to ensure fresh data
  console.log('[Leaderboard Jobs] Running initial calculations on startup...');

  // Use setTimeout to avoid blocking server startup
  setTimeout(() => {
    calculateDailyStats().catch(err => console.error('[Daily Stats] Initial calculation error:', err));
    calculateWeeklyStats().catch(err => console.error('[Weekly Stats] Initial calculation error:', err));
    calculateMonthlyStats().catch(err => console.error('[Monthly Stats] Initial calculation error:', err));
  }, 5000); // Wait 5 seconds after startup

  return { dailyJob, weeklyJob, monthlyJob };
}

module.exports = {
  startLeaderboardJob,
  calculateDailyStats,
  calculateWeeklyStats,
  calculateMonthlyStats
};
