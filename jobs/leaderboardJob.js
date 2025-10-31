/**
 * Leaderboard Cron Jobs
 *
 * All three leaderboards run at midnight (12:00 AM UTC) every day:
 * - Daily: Calculates YESTERDAY's stats (completed 24 hours)
 * - Weekly: Calculates LAST 7 DAYS rolling window (today minus 7 days)
 * - Monthly: Calculates LAST 30 DAYS rolling window (today minus 30 days)
 *
 * Each job:
 * 1. Calculates the rolling period date range
 * 2. Aggregates all transactions for each user within that period
 * 3. Removes old stats (keeps only the most recent calculation)
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
 * Calculate weekly stats - LAST 7 DAYS (rolling window)
 */
async function calculateWeeklyStats() {
  try {
    console.log('[Weekly Stats] Starting calculation...');

    const now = new Date();

    // Calculate LAST 7 DAYS rolling window
    // Start: 7 days ago at midnight
    // End: Today at midnight (now)
    const sevenDaysAgo = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 7,
      0, 0, 0, 0
    ));

    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));

    console.log(`[Weekly Stats] Calculating for last 7 days: ${sevenDaysAgo.toISOString()} to ${today.toISOString()}`);

    // Aggregate transactions from last 7 days grouped by user
    const weeklyTotals = await Transaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: sevenDaysAgo,
            $lt: today
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

    // Clean up old weekly stats (keep only the most recent 7 days)
    const cleanupDate = new Date(sevenDaysAgo);
    cleanupDate.setUTCDate(cleanupDate.getUTCDate() - 7);
    await WeeklyStat.deleteMany({ date: { $lt: cleanupDate } });

    // Remove today's old stats if they exist (for recalculation)
    await WeeklyStat.deleteMany({ date: today });

    // Insert new weekly stats
    if (weeklyTotals.length > 0) {
      const weeklyStats = weeklyTotals.map(item => ({
        userId: item._id,
        total: item.total,
        date: today // Store with today's date as the calculation date
      }));

      await WeeklyStat.insertMany(weeklyStats);
      console.log(`[Weekly Stats] Calculated stats for ${weeklyStats.length} users for last 7 days (${today.toISOString().split('T')[0]})`);
    } else {
      console.log('[Weekly Stats] No transactions found for last 7 days');
    }

    console.log('[Weekly Stats] Calculation completed successfully');
  } catch (error) {
    console.error('[Weekly Stats] Error calculating stats:', error);
  }
}

/**
 * Calculate monthly stats - LAST 30 DAYS (rolling window)
 */
async function calculateMonthlyStats() {
  try {
    console.log('[Monthly Stats] Starting calculation...');

    const now = new Date();

    // Calculate LAST 30 DAYS rolling window
    // Start: 30 days ago at midnight
    // End: Today at midnight (now)
    const thirtyDaysAgo = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 30,
      0, 0, 0, 0
    ));

    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));

    console.log(`[Monthly Stats] Calculating for last 30 days: ${thirtyDaysAgo.toISOString()} to ${today.toISOString()}`);

    // Aggregate transactions from last 30 days grouped by user
    const monthlyTotals = await Transaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: thirtyDaysAgo,
            $lt: today
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

    // Clean up old monthly stats (keep only the most recent 30 days)
    const cleanupDate = new Date(thirtyDaysAgo);
    cleanupDate.setUTCDate(cleanupDate.getUTCDate() - 30);
    await MonthlyStat.deleteMany({ date: { $lt: cleanupDate } });

    // Remove today's old stats if they exist (for recalculation)
    await MonthlyStat.deleteMany({ date: today });

    // Insert new monthly stats
    if (monthlyTotals.length > 0) {
      const monthlyStats = monthlyTotals.map(item => ({
        userId: item._id,
        total: item.total,
        date: today // Store with today's date as the calculation date
      }));

      await MonthlyStat.insertMany(monthlyStats);
      console.log(`[Monthly Stats] Calculated stats for ${monthlyStats.length} users for last 30 days (${today.toISOString().split('T')[0]})`);
    } else {
      console.log('[Monthly Stats] No transactions found for last 30 days');
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
  // All jobs run at midnight every day (0 0 * * *)
  // Calculates rolling windows for all three leaderboards
  const dailyJob = cron.schedule('0 0 * * *', () => {
    console.log('[Leaderboard Jobs] Running all calculations at midnight...');
    calculateDailyStats().catch(err => console.error('[Daily Stats] Error:', err));
    calculateWeeklyStats().catch(err => console.error('[Weekly Stats] Error:', err));
    calculateMonthlyStats().catch(err => console.error('[Monthly Stats] Error:', err));
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log('[Leaderboard Jobs] Scheduled:');
  console.log('  - All leaderboards: Midnight every day (12:00 AM UTC)');
  console.log('  - Daily: Calculates yesterday');
  console.log('  - Weekly: Calculates last 7 days (rolling window)');
  console.log('  - Monthly: Calculates last 30 days (rolling window)');

  // Run all calculations immediately on startup to ensure fresh data
  console.log('[Leaderboard Jobs] Running initial calculations on startup...');

  // Use setTimeout to avoid blocking server startup
  setTimeout(() => {
    calculateDailyStats().catch(err => console.error('[Daily Stats] Initial calculation error:', err));
    calculateWeeklyStats().catch(err => console.error('[Weekly Stats] Initial calculation error:', err));
    calculateMonthlyStats().catch(err => console.error('[Monthly Stats] Initial calculation error:', err));
  }, 5000); // Wait 5 seconds after startup

  return { dailyJob };
}

module.exports = {
  startLeaderboardJob,
  calculateDailyStats,
  calculateWeeklyStats,
  calculateMonthlyStats
};
