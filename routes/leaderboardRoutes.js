const express = require('express');
const router = express.Router();
const DailyStat = require('../models/DailyStat');
const WeeklyStat = require('../models/WeeklyStat');
const MonthlyStat = require('../models/MonthlyStat');
const User = require('../models/User');

/**
 * POST /api/leaderboard
 *
 * Fetch leaderboard based on type (daily, weekly, or monthly)
 *
 * Request body:
 *   { "type": "daily" | "weekly" | "monthly" }
 *
 * Response:
 *   {
 *     "success": true,
 *     "type": "daily",
 *     "data": [
 *       {
 *         "name": "John Doe",
 *         "balance": 120,
 *         "plan": "knowic",
 *         "referral_code": "abc123",
 *         "referral_of": "xyz789",
 *         "total": 45
 *       },
 *       ...
 *     ]
 *   }
 */
router.post('/leaderboard', async (req, res) => {
  try {
    const { type } = req.body;

    // Validate type parameter
    if (!type || !['daily', 'weekly', 'monthly', 'all-time'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be one of: daily, weekly, monthly, all-time',
      });
    }

    let data;

    // Handle all-time leaderboard separately
    if (type === 'all-time') {
      // Fetch users sorted by balance (all-time earnings)
      // Only include users with positive balance
      const users = await User.find({
        role: { $ne: 'admin' },
        balance: { $gt: 0 }
      })
        .sort({ balance: -1 })
        .limit(10)
        .select('name balance plan referral_code referral_of profileImage country')
        .lean();

      // Transform the data and fetch referral count for each user
      data = await Promise.all(
        users.map(async (user) => {
          // Count how many users this person has referred
          const referralCount = await User.countDocuments({
            referral_of: user._id,
          });

          return {
            name: user.name,
            balance: user.balance,
            plan: user.plan,
            referral_code: user.referral_code,
            referral_of: user.referral_of,
            profileImage: user.profileImage,
            country: user.country,
            total: user.balance, // For all-time, total is the balance
            members: referralCount,
          };
        })
      );
    } else {
      // Select the appropriate model based on type
      let StatModel;
      switch (type) {
        case 'daily':
          StatModel = DailyStat;
          break;
        case 'weekly':
          StatModel = WeeklyStat;
          break;
        case 'monthly':
          StatModel = MonthlyStat;
          break;
      }

      // Find the most recent period's date
      const mostRecentStat = await StatModel.findOne()
        .sort({ date: -1 })
        .select('date')
        .lean();

      // If no stats exist yet, return empty data
      if (!mostRecentStat) {
        return res.status(200).json({
          success: true,
          type,
          data: [],
          message: `No ${type} leaderboard data available yet`,
        });
      }

      // Fetch top 10 users for the most recent period sorted by total (descending)
      const leaderboard = await StatModel.find({ date: mostRecentStat.date })
        .sort({ total: -1 })
        .limit(10)
        .populate('userId', 'name balance plan referral_code referral_of profileImage country')
        .lean();

      // Transform the data to match the expected response format
      // and fetch referral count for each user
      const transformedData = await Promise.all(
        leaderboard.map(async (entry) => {
          // Skip entries where user was deleted or userId is null
          if (!entry.userId || !entry.userId._id) {
            return null;
          }

          // Count how many users this person has referred
          const referralCount = await User.countDocuments({
            referral_of: entry.userId._id,
          });

          return {
            name: entry.userId.name || 'Unknown',
            balance: entry.userId.balance || 0,
            plan: entry.userId.plan || null,
            referral_code: entry.userId.referral_code || null,
            referral_of: entry.userId.referral_of || null,
            profileImage: entry.userId.profileImage || null,
            country: entry.userId.country || null,
            total: entry.total,
            members: referralCount,
          };
        })
      );

      // Filter out null entries (deleted users) and optionally filter out negative totals
      data = transformedData.filter(entry => entry !== null);
    }

    return res.status(200).json({
      success: true,
      type,
      data,
    });
  } catch (error) {
    console.error('[Leaderboard Route] Error fetching leaderboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
