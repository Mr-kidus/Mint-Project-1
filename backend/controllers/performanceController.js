import Performance from '../models/performanceModel.js';
import Plan from '../models/planModels.js';
import KPI from '../models/kpiModel2.js';
import mongoose from 'mongoose';

// Create or update performance entry
export const createOrUpdatePerformance = async (req, res) => {
  console.log("Request body received:", req.body);
  try {
    const {
      userId,
      role,
      year,
      quarter, // optional
      kpi_name,
      performanceMeasure,
      description,
      sectorId,
      subsectorId,
      deskId,
    } = req.body;

    if (!userId || !role || !kpi_name || !year || performanceMeasure === undefined) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Find KPI by name
    const kpi = await KPI.findOne({ kpi_name });
    if (!kpi) return res.status(404).json({ message: "KPI not found." });

    // Find the corresponding Plan to get planId
    const planFilter = {
      kpiId: kpi._id,
      year,
      role,
      sectorId,
      userId,
    };
    if (subsectorId) planFilter.subsectorId = subsectorId;

    const plan = await Plan.findOne(planFilter);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found for given criteria." });
    }

    const target = quarter && plan ? plan[quarter.toLowerCase()] || 0 : plan?.target || 0;

    // Prepare filter for existing Performance record
    const perfFilter = {
      userId,
      kpiId: kpi._id,
      year,
      sectorId,
      ...(subsectorId && { subsectorId }),
    };

    let existingPerformance = await Performance.findOne(perfFilter);

    // Build update object with planId included
    const update = {
      userId,
      role,
      kpiId: kpi._id,
      kpi_name,
      year,
      target,
      sectorId,
      subsectorId,
      deskId,
      planId: plan._id,        // <-- Add planId here
    };

    if (quarter) {
      const q = quarter.toLowerCase();
      const perfField = `${q}Performance`;

      // Get existing quarter performance values for validation
      const q1 = existingPerformance?.q1Performance?.value || 0;
      const q2 = existingPerformance?.q2Performance?.value || 0;
      const q3 = existingPerformance?.q3Performance?.value || 0;

      if (q === 'q2' && performanceMeasure < q1)
        return res.status(400).json({ message: "Q2 performance must be ≥ Q1." });
      if (q === 'q3' && performanceMeasure < q2)
        return res.status(400).json({ message: "Q3 performance must be ≥ Q2." });
      if (q === 'q4' && performanceMeasure < q3)
        return res.status(400).json({ message: "Q4 performance must be ≥ Q3." });

      // Set quarter-specific performance and description
      update[perfField] = {
        value: performanceMeasure,
        description: description || '',
      };

      // Recalculate yearly performance based on latest quarter performance
      const quarterFields = ['q4Performance', 'q3Performance', 'q2Performance', 'q1Performance'];
      let latest = 0;

      for (let field of quarterFields) {
        const val = field === perfField ? performanceMeasure : existingPerformance?.[field]?.value;
        if (val !== undefined && val !== null && val > 0) {
          latest = val;
          break;
        }
      }

      // Check current year's performance is not less than last year's
      const lastYearPerf = await Performance.findOne({
        userId,
        kpiId: kpi._id,
        year: year - 1,
        sectorId,
        ...(subsectorId && { subsectorId }),
      });
      const lastYearPerformance = lastYearPerf?.performanceYear || 0;

      if (latest < lastYearPerformance) {
        return res.status(400).json({
          message: `Current year performance (${latest}) must be ≥ last year's (${lastYearPerformance}).`,
        });
      }

      update.performanceYear = latest;
      update.performanceDescription = description || '';
    } else {
      // Yearly performance only
      const lastYearPerf = await Performance.findOne({
        userId,
        kpiId: kpi._id,
        year: year - 1,
        sectorId,
        ...(subsectorId && { subsectorId }),
      });

      const lastYearPerformance = lastYearPerf?.performanceYear || 0;
      if (performanceMeasure < lastYearPerformance) {
        return res.status(400).json({
          message: `Current year performance (${performanceMeasure}) must be ≥ last year's (${lastYearPerformance}).`,
        });
      }

      update.performanceYear = performanceMeasure;
      update.performanceDescription = description || '';
    }

    const result = await Performance.findOneAndUpdate(
      perfFilter,
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error("createOrUpdatePerformance error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};



// Get all performance entries with optional filters
export const getPerformances = async (req, res) => {
  try {
    const { userId, year, quarter, sectorId, subsectorId, deskId, kpiId } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (year) filter.year = year;
    if (quarter) filter.quarter = quarter;
    if (sectorId) filter.sectorId = sectorId;
    if (subsectorId) filter.subsectorId = subsectorId;
    if (deskId) filter.deskId = deskId;
    if (kpiId) filter.kpiId = kpiId;

    const performances = await Performance.find(filter)
      .populate('sectorId', 'name')
      .populate('subsectorId', 'name')
      .populate('deskId', 'name')
      .populate('kpiId', 'kpi_name')
      .sort({ year: 1, quarter: 1 });

    return res.status(200).json(performances);
  } catch (error) {
    console.error("getPerformances error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

// NEW: Get performanceMeasure + description + plan target by userId, role, year, quarter, kpiName, sectorId, subsectorId
export const getPerformanceAndTarget = async (req, res) => {
  try {
    const {
      userId,
      role,
      year,
      quarter,
      kpiName,
      sectorId,
      subsectorId,
    } = req.query;

    if (!userId || !role || !year || !kpiName) {
      return res.status(400).json({ message: "Missing required query parameters." });
    }

    // Find KPI by name
    const kpi = await KPI.findOne({ kpi_name: kpiName });
    if (!kpi) {
      return res.status(404).json({ message: "KPI not found." });
    }

    // Get plan target
    const planFilter = {
      kpiId: kpi._id,
      year,
      role,
      sectorId,
      userId,
    };
    if (subsectorId) planFilter.subsectorId = subsectorId;

    const plan = await Plan.findOne(planFilter);

    let target = 0;
    if (plan) {
      if (quarter) {
        target = plan[quarter.toLowerCase()] || 0;
      } else {
        target = plan.target || 0;
      }
    }

    // Fetch performance record
    const perfFilter = {
      userId,
      kpiId: kpi._id,
      year,
      sectorId,
    };
    if (subsectorId) perfFilter.subsectorId = subsectorId;

    const performance = await Performance.findOne(perfFilter);

    let performanceMeasure = "";
    let description = "";

    if (performance) {
      if (quarter) {
        const field = performance[`${quarter.toLowerCase()}Performance`];
        performanceMeasure = field?.value ?? "";
        description = field?.description ?? "";
      } else {
        performanceMeasure = performance.performanceYear ?? "";
        description = performance.performanceDescription ?? "";
      }
    }

    return res.status(200).json({
      target,
      performanceMeasure,
      description,
    });
  } catch (error) {
    console.error("getPerformanceAndTarget error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};


// You can keep other methods like getPerformanceById, updatePerformance, deletePerformance here as needed.


// Get single performance entry by ID
export const getPerformanceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid performance ID." });
    }

    const performance = await Performance.findById(id)
      .populate('sectorId', 'name')
      .populate('subsectorId', 'name')
      .populate('deskId', 'name')
      .populate('kpiId', 'kpi_name');

    if (!performance) return res.status(404).json({ message: "Performance not found." });

    return res.status(200).json(performance);
  } catch (error) {
    console.error("getPerformanceById error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

// Update performance entry by ID
export const updatePerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid performance ID." });
    }

    const updated = await Performance.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ message: "Performance not found." });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("updatePerformance error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

// Delete performance entry by ID
export const deletePerformance = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid performance ID." });
    }

    const deleted = await Performance.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Performance not found." });

    return res.status(200).json({ message: "Performance deleted successfully." });
  } catch (error) {
    console.error("deletePerformance error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};
