/**
 * Leaderboard Cron Job
 *
 * Runs every 5 minutes to process new transactions and update leaderboard stats.
 *
 * Process:
 * 1. Fetches last processed timestamp from JobMeta collection
 * 2. Queries new transactions created after that timestamp
 * 3. For each transaction, calculates adjusted amount:
 *    - Positive: direct and passive income
 *    - Negative: withdrawals
 * 4. Updates stats for each period (daily, weekly, monthly) using atomic upserts
 * 5. Updates lastProcessedAt timestamp
 *
 * Uses UTC timezone for consistency across all period calculations.
 */

const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const DailyStat = require('../models/DailyStat');
const WeeklyStat = require('../models/WeeklyStat');
const MonthlyStat = require('../models/MonthlyStat');
const JobMeta = require('../models/JobMeta');

/**
 * Get the start of the current day in UTC
 */
function getDailyStartDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Get the start of the current week (Monday) in UTC
 */
function getWeeklyStartDate() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days; else go back (dayOfWeek - 1) days

  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  return monday;
}

/**
 * Get the start of the current month in UTC
 */
function getMonthlyStartDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Process new transactions and update leaderboard stats
 */
async function updateLeaderboard() {
  try {
    console.log('[Leaderboard Job] Starting update...');

    // Get or create the job meta record
    let jobMeta = await JobMeta.findOne({ job: 'leaderboard_update' });

    if (!jobMeta) {
      // First run - create the meta record with epoch start
      jobMeta = await JobMeta.create({
        job: 'leaderboard_update',
        lastProcessedAt: new Date(0), // Start from epoch to process all transactions
      });
      console.log('[Leaderboard Job] First run - processing all transactions');
    }

    const lastProcessedAt = jobMeta.lastProcessedAt;
    const now = new Date();

    // Fetch all transactions created after lastProcessedAt
    const newTransactions = await Transaction.find({
      createdAt: { $gt: lastProcessedAt },
    }).sort({ createdAt: 1 }); // Process in chronological order

    if (newTransactions.length === 0) {
      console.log('[Leaderboard Job] No new transactions to process');
      return;
    }

    console.log(`[Leaderboard Job] Processing ${newTransactions.length} new transactions`);

    // Get period start dates
    const dailyStartDate = getDailyStartDate();
    const weeklyStartDate = getWeeklyStartDate();
    const monthlyStartDate = getMonthlyStartDate();

    // Process each transaction
    for (const tx of newTransactions) {
      // Calculate adjusted amount
      let adjustedAmount = 0;

      if (tx.type === 'direct' || tx.type === 'passive') {
        adjustedAmount = tx.amount; // Positive for income
      } else if (tx.type === 'withdrawal') {
        adjustedAmount = -tx.amount; // Negative for withdrawals
      }

      // Update daily stat
      await DailyStat.updateOne(
        { userId: tx.user_id, date: dailyStartDate },
        { $inc: { total: adjustedAmount } },
        { upsert: true }
      );

      // Update weekly stat
      await WeeklyStat.updateOne(
        { userId: tx.user_id, date: weeklyStartDate },
        { $inc: { total: adjustedAmount } },
        { upsert: true }
      );

      // Update monthly stat
      await MonthlyStat.updateOne(
        { userId: tx.user_id, date: monthlyStartDate },
        { $inc: { total: adjustedAmount } },
        { upsert: true }
      );
    }

    // Update the last processed timestamp
    await JobMeta.updateOne(
      { job: 'leaderboard_update' },
      { lastProcessedAt: now }
    );

    console.log('[Leaderboard Job] Update completed successfully');
  } catch (error) {
    console.error('[Leaderboard Job] Error updating leaderboard:', error);
  }
}

/**
 * Initialize and start the cron job
 * Runs every 5 minutes
 */
function startLeaderboardJob() {
  // Run every 5 minutes: */5 * * * *
  const job = cron.schedule('*/5 * * * *', updateLeaderboard, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log('[Leaderboard Job] Scheduled to run every 5 minutes (UTC)');

  return job;
}

module.exports = { startLeaderboardJob, updateLeaderboard };
