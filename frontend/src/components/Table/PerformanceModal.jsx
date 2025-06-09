import React, { useState, useEffect } from "react";
import axios from "axios";

const BASE_URL = "http://localhost:1221";

function PerformanceModal({ modalInfo, closeModal, handleFormSubmit }) {
  const [performanceMeasure, setPerformanceMeasure] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  useEffect(() => {
    let quarter = null;
    let year = null;

    if (modalInfo.period) {
      const parts = modalInfo.period.split("-");
      if (parts.length === 2) {
        if (parts[0].toLowerCase().startsWith("q")) {
          quarter = parts[0].toUpperCase();
          year = parts[1];
        } else if (parts[0].toLowerCase() === "year") {
          year = parts[1];
        }
      }
    }

    console.log("PerformanceModal useEffect with modalInfo:", modalInfo);
    console.log("Parsed quarter:", quarter, "year:", year);

    async function fetchData() {
      if (
        !modalInfo.kpiName ||
        !modalInfo.kraId ||
        !modalInfo.role ||
        !modalInfo.userId ||
        !year
      ) {
        console.log("fetchData early return due to missing params");
        setWarning(
          "Missing required data to fetch data: " +
            [
              !modalInfo.kpiName && "kpiName",
              !modalInfo.kraId && "kraId",
              !modalInfo.role && "role",
              !modalInfo.userId && "userId",
              !year && "year",
            ]
              .filter(Boolean)
              .join(", ")
        );
        setPerformanceMeasure("");
        setDescription("");
        setTarget("");
        setError("");
        setLoading(false);
        return;
      }

      setWarning("");
      setLoading(true);

      try {
        const planParams = {
          kpiName: modalInfo.kpiName,
          kraId: modalInfo.kraId,
          role: modalInfo.role,
          sectorId: modalInfo.sectorId,
          subsectorId: modalInfo.subsectorId,
          userId: modalInfo.userId,
          year,
        };
        if (quarter) {
          planParams.quarter = quarter;
        }

        console.log("Fetching target with params:", planParams);
        const planRes = await axios.get(`${BASE_URL}/api/plans/target`, {
          params: planParams,
        });

        const fetchedTarget = planRes.data?.target?.toString() || "";
        console.log("Fetched target:", fetchedTarget);
        setTarget(fetchedTarget);

        const perfParams = { ...planParams };
        console.log("Fetching performance with params:", perfParams);
        const perfRes = await axios.get(
          `${BASE_URL}/api/performance/measure`,
          { params: perfParams }
        );

        const perfData = perfRes.data || {};
        console.log("Fetched performance data:", perfData);

        setPerformanceMeasure(perfData.performanceMeasure?.toString() || "");
        setDescription(perfData.description || "");
        setError("");
      } catch (err) {
        console.error("Error fetching data:", err);
        setPerformanceMeasure("");
        setDescription("");
        setTarget("");
        setError("Could not fetch performance or target for this period.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [modalInfo]);

  // Extract quarter and year again for use in rendering and submission
  let quarter = null;
  let year = null;
  if (modalInfo.period) {
    const parts = modalInfo.period.split("-");
    if (parts.length === 2) {
      if (parts[0].toLowerCase().startsWith("q")) {
        quarter = parts[0].toUpperCase();
        year = parts[1];
      } else if (parts[0].toLowerCase() === "year") {
        year = parts[1];
      }
    }
  }

  const handlePerformanceChange = (e) => {
    setPerformanceMeasure(e.target.value);
    setError("");
    setWarning("");
  };

  const handleDescriptionChange = (e) => {
    setDescription(e.target.value);
    setWarning("");
  };

  const onSubmit = (e) => {
    e.preventDefault();

    if (loading || warning) return;

    if (performanceMeasure === "") {
      setError("Performance measure is required.");
      return;
    }

    const perfValue = parseFloat(performanceMeasure);
    if (isNaN(perfValue)) {
      setError("Please enter a valid number for performance measure.");
      return;
    }

    const data = {
      ...modalInfo,
      year,
      quarter,
      performanceMeasure: perfValue,
      description,
    };

    handleFormSubmit(data);
    closeModal();
  };

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-lg font-bold mb-4">Enter KPI Performance</h2>

        {loading && (
          <p className="text-blue-600 font-semibold mb-2">Loading performance data...</p>
        )}

        {warning && (
          <p className="mb-2 text-yellow-700 font-semibold bg-yellow-100 p-2 rounded">
            {warning}
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="kpiName" className="block font-semibold">
              KPI Name
            </label>
            <input
              id="kpiName"
              type="text"
              readOnly
              value={modalInfo.kpiName || ""}
              className="w-full border px-3 py-1 rounded bg-gray-100"
            />
          </div>

          <div>
            <label htmlFor="period" className="block font-semibold">
              {quarter ? "Quarter" : "Year"}
            </label>
            <input
              id="period"
              type="text"
              readOnly
              value={quarter ? `${quarter} ${year}` : year}
              className="w-full border px-3 py-1 rounded bg-gray-100"
            />
          </div>

          <div>
            <label htmlFor="target" className="block font-semibold">Target</label>
            <input
              id="target"
              type="number"
              readOnly
              value={target}
              className="w-full border px-3 py-1 rounded bg-gray-100"
            />
          </div>

          <div>
            <label htmlFor="performanceMeasure" className="block font-semibold">
              Performance Measure
            </label>
            <input
              id="performanceMeasure"
              type="number"
              min="0"
              step="any"
              value={performanceMeasure}
              onChange={handlePerformanceChange}
              className="w-full border px-3 py-1 rounded"
              required
              disabled={loading || !!warning}
              placeholder="Enter actual performance"
            />
            {error && (
              <p className="text-red-600 text-sm mt-1 font-semibold">{error}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block font-semibold">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={handleDescriptionChange}
              rows={3}
              className="w-full border px-3 py-1 rounded"
              placeholder="Enter performance description"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-3 py-1 rounded border text-gray-600 hover:bg-gray-100"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
              disabled={loading || !!error || !!warning}
            >
              {loading ? "Loading..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PerformanceModal;
