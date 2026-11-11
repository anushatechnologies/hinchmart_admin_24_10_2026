import api from "./axios";

const unwrapData = (payload) =>
  payload?.data !== undefined ? payload.data : payload;

export const getAdminPincodes = async (params = {}, config = {}) => {
  const response = await api.get("/admin/pincodes", { ...config, params });
  return response.data;
};

export const createAdminPincode = async (pincode) => {
  const response = await api.post("/admin/pincodes", pincode);
  return unwrapData(response.data);
};

export const updateAdminPincode = async (id, pincode) => {
  const response = await api.put(`/admin/pincodes/${encodeURIComponent(id)}`, pincode);
  return unwrapData(response.data);
};

export const configureAdminPincodeService = async (id, service) => {
  const response = await api.post(
    `/admin/pincodes/${encodeURIComponent(id)}/services`,
    service
  );
  return unwrapData(response.data);
};

export const deleteAdminPincode = async (id) => {
  const response = await api.delete(`/admin/pincodes/${encodeURIComponent(id)}`);
  return response.data;
};
