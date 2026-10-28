import api from "./axios";

/**
 * Journey 12: Fleet & Logistics Vehicle Management (HinchExpress Microservice)
 * Controller: AdminVehicleTypeController.java
 *
 * Endpoints:
 * - GET    /api/admin/vehicle-types       - List all configured delivery fleet vehicle types
 * - POST   /api/admin/vehicle-types       - Create new vehicle type configuration
 * - PUT    /api/admin/vehicle-types/{id}  - Update vehicle type specs and freight rates
 * - DELETE /api/admin/vehicle-types/{id}  - Soft/Hard delete vehicle type configuration
 */

export const getVehicleTypes = async () => {
  try {
    const res = await api.get("/admin/vehicle-types");
    const data = res.data?.data || res.data;
    if (Array.isArray(data)) return data;
  } catch (err) {
    try {
      const fallback = await api.get("/vehicle-types");
      const data = fallback.data?.data || fallback.data;
      if (Array.isArray(data)) return data;
    } catch {
      console.warn("[Vehicle Types API] Fetch failed:", err?.message);
    }
  }
  return [];
};

export const createVehicleType = async (vehicleData) => {
  const payload = {
    code: vehicleData.code?.toUpperCase() || "TWO_WHEELER",
    name: vehicleData.name || "Standard Carrier",
    description: vehicleData.description || "",
    maxWeightKg: Number(vehicleData.maxWeightKg || 20),
    sizeDimensions: vehicleData.sizeDimensions || "40x40x40 cm",
    baseFare: Number(vehicleData.baseFare || 40),
    baseDistanceKm: Number(vehicleData.baseDistanceKm || 2.0),
    perKmRate: Number(vehicleData.perKmRate || 12.0),
    minimumFare: Number(vehicleData.minimumFare || 40),
    active: vehicleData.active !== undefined ? Boolean(vehicleData.active) : true,
    sortOrder: Number(vehicleData.sortOrder || 1),
    imageUrl: vehicleData.imageUrl || "",
  };

  const res = await api.post("/admin/vehicle-types", payload);
  return res.data?.data || res.data;
};

export const updateVehicleType = async (id, vehicleData) => {
  const res = await api.put(`/admin/vehicle-types/${id}`, vehicleData);
  return res.data?.data || res.data;
};

export const deleteVehicleType = async (id) => {
  const res = await api.delete(`/admin/vehicle-types/${id}`);
  return res.data?.data || res.data;
};

export default {
  getVehicleTypes,
  createVehicleType,
  updateVehicleType,
  deleteVehicleType,
};
