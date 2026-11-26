import { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Users,
  MapPin,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  ExternalLink,
  Navigation,
  ShieldAlert,
} from "lucide-react";
import {
  getHubs,
  createHub,
  updateHub,
  toggleHubStatus,
  deleteHub,
  getHubRiders,
} from "../api/hubApi";
import { useToast } from "../components/ToastContext";
import { formatDateTime } from "../utils/formatUtils";

export default function Hubs() {
  const toast = useToast();

  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals & Drawers
  const [modalMode, setModalMode] = useState(null); // "create" | "edit" | null
  const [selectedHub, setSelectedHub] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Riders Drawer/Modal
  const [ridersModalHub, setRidersModalHub] = useState(null);
  const [riders, setRiders] = useState([]);
  const [loadingRiders, setLoadingRiders] = useState(false);

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchHubs = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (cityFilter !== "ALL") params.city = cityFilter;
      if (statusFilter !== "ALL") params.active = statusFilter === "ACTIVE";

      const data = await getHubs(params);
      setHubs(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "Failed to load fulfillment hubs.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubs();
  }, [cityFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHubs();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Unique list of cities from hubs for filter dropdown
  const uniqueCities = useMemo(() => {
    const set = new Set();
    hubs.forEach((h) => {
      if (h.city?.trim()) set.add(h.city.trim());
    });
    return Array.from(set).sort();
  }, [hubs]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = hubs.length;
    const active = hubs.filter((h) => h.active).length;
    const inactive = total - active;
    const totalRiders = hubs.reduce((sum, h) => sum + (Number(h.assignedRidersCount) || 0), 0);
    return { total, active, inactive, totalRiders };
  }, [hubs]);

  // Open Create Modal
  const openCreateModal = () => {
    setFormError("");
    setFormData({
      code: "",
      name: "",
      addressLine: "",
      city: "",
      state: "",
      pincode: "",
      latitude: "",
      longitude: "",
      contactPhone: "",
      active: true,
    });
    setModalMode("create");
    setSelectedHub(null);
  };

  // Open Edit Modal
  const openEditModal = (hub) => {
    setFormError("");
    setSelectedHub(hub);
    setFormData({
      name: hub.name || "",
      addressLine: hub.addressLine || "",
      city: hub.city || "",
      state: hub.state || "",
      pincode: hub.pincode || "",
      latitude: hub.latitude !== undefined && hub.latitude !== null ? String(hub.latitude) : "",
      longitude: hub.longitude !== undefined && hub.longitude !== null ? String(hub.longitude) : "",
      contactPhone: hub.contactPhone || "",
      active: Boolean(hub.active),
    });
    setModalMode("edit");
  };

  const closeModal = () => {
    if (!submitting) {
      setModalMode(null);
      setSelectedHub(null);
      setFormError("");
    }
  };

  // Handle Form Submission (Create or Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    const trimmedCode = (formData.code || "").trim().toUpperCase();
    const trimmedName = (formData.name || "").trim();
    const trimmedAddress = (formData.addressLine || "").trim();
    const trimmedCity = (formData.city || "").trim();
    const trimmedState = (formData.state || "").trim();
    const cleanedPincode = (formData.pincode || "").replace(/\D/g, "").slice(0, 6);
    const trimmedPhone = (formData.contactPhone || "").trim();

    if (!trimmedName) {
      setFormError("Hub name is required.");
      setSubmitting(false);
      return;
    }
    if (trimmedName.length > 100) {
      setFormError("Hub name cannot exceed 100 characters.");
      setSubmitting(false);
      return;
    }
    if (!trimmedAddress) {
      setFormError("Address line is required.");
      setSubmitting(false);
      return;
    }
    if (trimmedAddress.length > 255) {
      setFormError("Address line cannot exceed 255 characters.");
      setSubmitting(false);
      return;
    }
    if (!trimmedCity) {
      setFormError("City is required.");
      setSubmitting(false);
      return;
    }
    if (!trimmedState) {
      setFormError("State is required.");
      setSubmitting(false);
      return;
    }
    if (cleanedPincode.length !== 6) {
      setFormError("Pincode must be exactly 6 digits.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        name: trimmedName,
        addressLine: trimmedAddress,
        city: trimmedCity,
        state: trimmedState,
        pincode: cleanedPincode,
        latitude: formData.latitude !== "" ? Number(formData.latitude) : 0,
        longitude: formData.longitude !== "" ? Number(formData.longitude) : 0,
        contactPhone: trimmedPhone,
        active: Boolean(formData.active),
      };

      if (modalMode === "create") {
        if (trimmedCode) payload.code = trimmedCode;
        await createHub(payload);
        toast.success("Fulfillment hub created successfully!");
      } else {
        await updateHub(selectedHub.id || selectedHub.code, payload);
        toast.success("Fulfillment hub updated successfully!");
      }

      closeModal();
      await fetchHubs();
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "Failed to save fulfillment hub.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (hub) => {
    const nextStatus = !hub.active;
    try {
      await toggleHubStatus(hub.id || hub.code, nextStatus);
      toast.success(`Hub ${hub.code || hub.name} ${nextStatus ? "activated" : "deactivated"}.`);
      await fetchHubs();
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "Failed to update hub status.";
      toast.error(msg);
    }
  };

  // View Assigned Riders
  const handleViewRiders = async (hub) => {
    setRidersModalHub(hub);
    setLoadingRiders(true);
    setRiders([]);
    try {
      const data = await getHubRiders(hub.id || hub.code);
      setRiders(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "Failed to load assigned riders.";
      toast.error(msg);
    } finally {
      setLoadingRiders(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (hub) => {
    setDeleteTarget(hub);
    setPermanentDelete(false);
  };

  const closeDeleteModal = () => {
    if (!deleting) {
      setDeleteTarget(null);
      setPermanentDelete(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteHub(deleteTarget.id || deleteTarget.code, permanentDelete);
      toast.success(
        permanentDelete
          ? "Fulfillment hub permanently deleted."
          : "Fulfillment hub deactivated successfully."
      );
      closeDeleteModal();
      await fetchHubs();
    } catch (err) {
      const status = err?.statusCode || err?.response?.status;
      let msg = err?.message || err?.response?.data?.message;
      if (status === 409 || err?.statusCode === 409) {
        msg = "Cannot permanently delete hub with active assigned riders. Please reassign riders first or use soft deactivation.";
      }
      toast.error(msg || "Failed to delete fulfillment hub.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="hubs-page page-container">
      {/* Header */}
      <div className="hubs-heading">
        <div>
          <h1>Fulfillment Hubs & Dark Stores</h1>
          <p>Manage dark stores, fulfillment centers, dispatch hubs, and rider assignments</p>
        </div>
        <div className="hubs-heading-actions">
          <button className="hubs-btn-secondary" onClick={fetchHubs} disabled={loading}>
            <RefreshCw size={15} className={loading ? "delivery-spin" : ""} />
            Refresh
          </button>
          <button className="hubs-btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            Add Hub
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="delivery-error">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="hubs-stats">
        <div className="hubs-stat-card">
          <div className="hubs-stat-icon">
            <Building2 size={22} />
          </div>
          <div className="hubs-stat-info">
            <span className="hubs-stat-label">Total Hubs</span>
            <span className="hubs-stat-val">{stats.total}</span>
          </div>
        </div>

        <div className="hubs-stat-card">
          <div className="hubs-stat-icon green">
            <CheckCircle size={22} />
          </div>
          <div className="hubs-stat-info">
            <span className="hubs-stat-label">Active Dark Stores</span>
            <span className="hubs-stat-val">{stats.active}</span>
          </div>
        </div>

        <div className="hubs-stat-card">
          <div className="hubs-stat-icon blue">
            <XCircle size={22} />
          </div>
          <div className="hubs-stat-info">
            <span className="hubs-stat-label">Inactive / Paused</span>
            <span className="hubs-stat-val">{stats.inactive}</span>
          </div>
        </div>

        <div className="hubs-stat-card">
          <div className="hubs-stat-icon purple">
            <Users size={22} />
          </div>
          <div className="hubs-stat-info">
            <span className="hubs-stat-label">Assigned Riders</span>
            <span className="hubs-stat-val">{stats.totalRiders}</span>
          </div>
        </div>
      </div>

      {/* Panel with Toolbar and Table */}
      <section className="hubs-panel">
        <div className="hubs-toolbar">
          <div className="hubs-search-box">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, city, or pincode..."
            />
          </div>

          <div className="hubs-filters">
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="ALL">All Cities</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Master Table */}
        <div className="hubs-table-scroll">
          <table className="hubs-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Hub Name & Address</th>
                <th>City & State</th>
                <th>Pincode</th>
                <th>Contact Phone</th>
                <th>Coordinates</th>
                <th>Assigned Riders</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="hubs-empty-state">
                    <Loader2 size={24} className="delivery-spin" style={{ margin: "0 auto 8px" }} />
                    Loading fulfillment hubs...
                  </td>
                </tr>
              ) : hubs.length === 0 ? (
                <tr>
                  <td colSpan="9" className="hubs-empty-state">
                    No fulfillment hubs found matching your filters.
                  </td>
                </tr>
              ) : (
                hubs.map((hub) => (
                  <tr key={hub.id || hub.code}>
                    <td>
                      <span className="hubs-code-badge">{hub.code}</span>
                    </td>
                    <td>
                      <div className="hubs-hub-info">
                        <strong>{hub.name}</strong>
                        <span>{hub.addressLine}</span>
                      </div>
                    </td>
                    <td>
                      {hub.city || "—"}, {hub.state || "—"}
                    </td>
                    <td>
                      <strong>{hub.pincode}</strong>
                    </td>
                    <td>
                      {hub.contactPhone ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Phone size={12} style={{ color: "#64748b" }} />
                          {hub.contactPhone}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {hub.latitude && hub.longitude ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${hub.latitude},${hub.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hubs-coords-tag"
                          title="View on Google Maps"
                        >
                          <Navigation size={11} />
                          {Number(hub.latitude).toFixed(4)}, {Number(hub.longitude).toFixed(4)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        className="hubs-riders-btn"
                        onClick={() => handleViewRiders(hub)}
                        title="Click to view assigned delivery riders"
                      >
                        <Users size={12} />
                        {hub.assignedRidersCount || 0} riders
                      </button>
                    </td>
                    <td>
                      <button
                        className={`hubs-status-toggle ${hub.active ? "active" : "inactive"}`}
                        onClick={() => handleToggleStatus(hub)}
                        title={`Click to ${hub.active ? "deactivate" : "activate"}`}
                      >
                        {hub.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td>
                      <div className="hubs-actions">
                        <button
                          className="hubs-action-btn"
                          title="Edit Hub Details"
                          onClick={() => openEditModal(hub)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="hubs-action-btn danger"
                          title="Deactivate or Delete Hub"
                          onClick={() => openDeleteModal(hub)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create / Edit Hub Modal */}
      {modalMode && (
        <div className="hubs-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <form className="hubs-modal" onSubmit={handleSubmit}>
            <div className="hubs-modal-header">
              <div>
                <h2>{modalMode === "create" ? "Add Fulfillment Hub" : "Edit Fulfillment Hub"}</h2>
                <p>Configure dark store location, address, coordinates, and contact details</p>
              </div>
              <button type="button" className="hubs-modal-close" onClick={closeModal} disabled={submitting}>
                <X size={18} />
              </button>
            </div>

            <div className="hubs-modal-body">
              {formError && (
                <div className="delivery-error" style={{ marginBottom: 16 }}>
                  <span>{formError}</span>
                  <button type="button" onClick={() => setFormError("")}>
                    <X size={15} />
                  </button>
                </div>
              )}

              <div className="hubs-form-grid">
                {modalMode === "create" && (
                  <label>
                    <div className="hubs-field-header">
                      <span>Hub Code (Optional)</span>
                      <span className={`hubs-char-counter ${(formData.code || "").length >= 50 ? "limit" : ""}`}>
                        {(formData.code || "").length}/50
                      </span>
                    </div>
                    <input
                      maxLength={50}
                      style={{ textTransform: "uppercase" }}
                      value={formData.code || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                        })
                      }
                      placeholder="e.g. HUB-004 (Auto-assigned if blank)"
                    />
                  </label>
                )}

                <label className={modalMode === "create" ? "" : "hubs-span-2"}>
                  <div className="hubs-field-header">
                    <span>Hub Name *</span>
                    <span className={`hubs-char-counter ${(formData.name || "").length >= 100 ? "limit" : ""}`}>
                      {(formData.name || "").length}/100
                    </span>
                  </div>
                  <input
                    required
                    maxLength={100}
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Central Fulfilment Hub (Okhla)"
                  />
                  {(formData.name || "").length >= 100 && (
                    <span className="hubs-field-error">Maximum 100 characters reached.</span>
                  )}
                </label>

                <label className="hubs-span-2">
                  <div className="hubs-field-header">
                    <span>Physical Address *</span>
                    <span className={`hubs-char-counter ${(formData.addressLine || "").length >= 255 ? "limit" : ""}`}>
                      {(formData.addressLine || "").length}/255
                    </span>
                  </div>
                  <textarea
                    required
                    maxLength={255}
                    value={formData.addressLine || ""}
                    onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
                    placeholder="Full facility address line, plot number, landmark (max 255 characters)..."
                  />
                  {(formData.addressLine || "").length >= 255 && (
                    <span className="hubs-field-error">Maximum 255 characters reached.</span>
                  )}
                </label>

                <label>
                  City *
                  <input
                    required
                    maxLength={100}
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. New Delhi"
                  />
                </label>

                <label>
                  State *
                  <input
                    required
                    maxLength={100}
                    value={formData.state || ""}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Delhi"
                  />
                </label>

                <label>
                  Pincode * <small>(6 Digits)</small>
                  <input
                    required
                    maxLength={6}
                    value={formData.pincode || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })
                    }
                    placeholder="e.g. 110020"
                  />
                </label>

                <label>
                  Contact Phone
                  <input
                    value={formData.contactPhone || ""}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="e.g. +91 11 4050 0001"
                  />
                </label>

                <label>
                  Latitude <small>(e.g. 28.535500)</small>
                  <input
                    type="number"
                    step="0.00000001"
                    value={formData.latitude ?? ""}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="28.535500"
                  />
                </label>

                <label>
                  Longitude <small>(e.g. 77.273200)</small>
                  <input
                    type="number"
                    step="0.00000001"
                    value={formData.longitude ?? ""}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="77.273200"
                  />
                </label>

                <label className="hubs-span-2 hubs-check-label">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.active)}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  />
                  <span>Hub is active and operational for dispatch orders</span>
                </label>
              </div>
            </div>

            <div className="hubs-modal-footer">
              <button type="button" className="hubs-btn-secondary" onClick={closeModal} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="hubs-btn-primary" disabled={submitting}>
                {submitting && <Loader2 size={15} className="delivery-spin" />}
                {modalMode === "create" ? "Create Hub" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assigned Riders Modal */}
      {ridersModalHub && (
        <div
          className="hubs-modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setRidersModalHub(null)}
        >
          <div className="hubs-modal hubs-riders-modal">
            <div className="hubs-modal-header">
              <div>
                <h2>Assigned Riders: {ridersModalHub.name}</h2>
                <p>
                  Active fleet assigned to {ridersModalHub.code} ({ridersModalHub.city})
                </p>
              </div>
              <button
                type="button"
                className="hubs-modal-close"
                onClick={() => setRidersModalHub(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="hubs-modal-body">
              {loadingRiders ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#64748b" }}>
                  <Loader2 size={24} className="delivery-spin" style={{ margin: "0 auto 8px" }} />
                  Loading assigned riders...
                </div>
              ) : riders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8" }}>
                  No delivery riders are currently assigned to this hub.
                </div>
              ) : (
                <div className="hubs-riders-list">
                  {riders.map((rider) => (
                    <div key={rider.customerId || rider.id} className="hubs-rider-card">
                      <div className="hubs-rider-main">
                        <strong>{rider.name}</strong>
                        <span>
                          {rider.phone} &bull; {rider.email}
                        </span>
                        {rider.vehicleNumber && (
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            Vehicle: {rider.vehicleNumber} (License: {rider.licenseNumber || "—"})
                          </span>
                        )}
                      </div>
                      <div className="hubs-rider-badges">
                        {rider.vehicleType && (
                          <span className="hubs-vehicle-tag">{rider.vehicleType}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hubs-modal-footer">
              <button
                type="button"
                className="hubs-btn-secondary"
                onClick={() => setRidersModalHub(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirmation Modal */}
      {deleteTarget && (
        <div
          className="hubs-modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && closeDeleteModal()}
        >
          <div className="hubs-modal" style={{ maxWidth: 480 }}>
            <div className="hubs-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "#fef2f2",
                    color: "#dc2626",
                  }}
                >
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h2>Manage Hub Deletion</h2>
                  <p>{deleteTarget.code} &mdash; {deleteTarget.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="hubs-modal-close"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                <X size={18} />
              </button>
            </div>

            <div className="hubs-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                Choose how you want to handle this hub:
              </p>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="delType"
                  checked={!permanentDelete}
                  onChange={() => setPermanentDelete(false)}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: 12.5, color: "#0f172a" }}>
                    Soft Deactivate (Recommended)
                  </strong>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Sets hub status to inactive. Preserves order history and existing rider assignments.
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  background: "#fffbfb",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="delType"
                  checked={permanentDelete}
                  onChange={() => setPermanentDelete(true)}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: 12.5, color: "#991b1b" }}>
                    Permanent Delete
                  </strong>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Deletes record from database. Only allowed if <strong>0 riders</strong> are assigned (otherwise blocked by 409 Conflict).
                  </span>
                  {deleteTarget.assignedRidersCount > 0 && (
                    <span
                      style={{
                        display: "block",
                        marginTop: 4,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "#dc2626",
                      }}
                    >
                      Warning: Currently has {deleteTarget.assignedRidersCount} riders assigned.
                    </span>
                  )}
                </div>
              </label>
            </div>

            <div className="hubs-modal-footer">
              <button
                type="button"
                className="hubs-btn-secondary"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hubs-btn-primary"
                style={{ background: permanentDelete ? "#dc2626" : "#d97706" }}
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 size={15} className="delivery-spin" />}
                {permanentDelete ? "Confirm Permanent Delete" : "Deactivate Hub"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
