import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Bike,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Radio,
  Eye,
  FileCheck,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  ExternalLink,
  Zap,
  Truck,
  Check,
  X,
  Lock,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  getFleetRiders,
  getRiderApplications,
  getRiderApplicationById,
  getRiderDocumentDownloadUrl,
  approveRiderApplication,
  rejectRiderApplication,
  getReactivationRequests,
  createReactivationRequest,
  approveReactivationRequest,
  rejectReactivationRequest,
  getRiderVehicleCategory,
  updateRiderVehicleCategory,
} from "../api/riderApi";
import { getHubs } from "../api/hubApi";
import { useToast } from "../components/ToastContext";
import { useAuth } from "../firebase/AuthContext";
import { formatDateTime } from "../utils/formatUtils";
import "../styles/riders.css";

export default function Riders({ defaultTab = "fleet" }) {
  const toast = useToast();
  const { user } = useAuth();
  const location = useLocation();

  // Tab State: "fleet" | "applications" | "reactivations" | "categories"
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes("application")) return "applications";
    if (location.pathname.includes("reactivation")) return "reactivations";
    if (location.pathname.includes("fleet")) return "fleet";
    return defaultTab;
  });

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hubs, setHubs] = useState([]);

  // Data Collections
  const [fleetRiders, setFleetRiders] = useState([]);
  const [applications, setApplications] = useState([]);
  const [reactivations, setReactivations] = useState([]);

  // Filters
  const [hubFilter, setHubFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [eligibilityFilter, setEligibilityFilter] = useState("ALL");
  const [vehicleCatFilter, setVehicleCatFilter] = useState("ALL");

  // Modals & Inspection Drawers
  const [inspectingApplication, setInspectingApplication] = useState(null);
  const [loadingAppDetail, setLoadingAppDetail] = useState(false);
  const [docPreviewUrl, setDocPreviewUrl] = useState(null);
  const [loadingDocUrl, setLoadingDocUrl] = useState(false);

  // Approve / Reject Application Modal
  const [appActionModal, setAppActionModal] = useState(null); // { type: "approve"|"reject", app: object }
  const [appActionReason, setAppActionReason] = useState("");
  const [appActionSubmitting, setAppActionSubmitting] = useState(false);

  // Reactivation Modals
  const [createReactModalOpen, setCreateReactModalOpen] = useState(false);
  const [reactRiderTarget, setReactRiderTarget] = useState(null);
  const [reactDeactivationReason, setReactDeactivationReason] = useState("");
  const [reactJustification, setReactJustification] = useState("");
  const [reactDocUrl, setReactDocUrl] = useState("");
  const [reactSubmitting, setReactSubmitting] = useState(false);

  // Reactivation Supervisor Action Modal
  const [reactActionModal, setReactActionModal] = useState(null); // { type: "approve"|"reject", req: object }
  const [reactNotes, setReactNotes] = useState("");
  const [reactActionSubmitting, setReactActionSubmitting] = useState(false);

  // Vehicle Category Modal
  const [categoryModalRider, setCategoryModalRider] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("TWO_WHEELER");
  const [maxPayloadKg, setMaxPayloadKg] = useState(30);
  const [maxVolumeLiters, setMaxVolumeLiters] = useState(65);
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // Current logged in user email
  const currentUserEmail = user?.email || localStorage.getItem("adminUserEmail") || "admin@hinchmart.com";

  // Fetch Hubs for dropdowns
  useEffect(() => {
    let mounted = true;
    getHubs()
      .then((data) => {
        if (mounted && Array.isArray(data)) setHubs(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch tab-specific data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "fleet" || activeTab === "categories") {
        const params = {};
        if (search.trim()) params.search = search.trim();
        if (hubFilter !== "ALL") params.hubId = hubFilter;
        if (statusFilter !== "ALL") params.operationalStatus = statusFilter;
        if (eligibilityFilter !== "ALL") params.isEligible = eligibilityFilter === "ELIGIBLE";
        if (vehicleCatFilter !== "ALL") params.vehicleCategory = vehicleCatFilter;

        const data = await getFleetRiders(params);
        setFleetRiders(Array.isArray(data) ? data : []);
      }

      if (activeTab === "applications") {
        const params = {};
        if (search.trim()) params.search = search.trim();
        if (statusFilter !== "ALL") params.status = statusFilter;
        const data = await getRiderApplications(params);
        setApplications(Array.isArray(data) ? data : []);
      }

      if (activeTab === "reactivations") {
        const params = {};
        if (statusFilter !== "ALL") params.status = statusFilter;
        const data = await getReactivationRequests(params);
        setReactivations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to load rider records.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, hubFilter, statusFilter, eligibilityFilter, vehicleCatFilter, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 350);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Counts for Badges & KPI
  const pendingAppsCount = useMemo(
    () => applications.filter((a) => a.status === "PENDING").length,
    [applications]
  );
  const pendingReactivationsCount = useMemo(
    () => reactivations.filter((r) => r.status === "PENDING").length,
    [reactivations]
  );

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  // Open Application KYC Inspector Drawer
  const handleInspectApp = async (app) => {
    setLoadingAppDetail(true);
    setInspectingApplication(app);
    try {
      const full = await getRiderApplicationById(app.id || app.applicationId);
      if (full) setInspectingApplication(full);
    } catch (err) {
      toast.error("Could not fetch full KYC documents: " + (err?.message || err));
    } finally {
      setLoadingAppDetail(false);
    }
  };

  // View Document Pre-signed 15-minute download URL
  const handleViewDocUrl = async (applicationId, docType) => {
    setLoadingDocUrl(true);
    try {
      const res = await getRiderDocumentDownloadUrl(applicationId, docType);
      const url = res?.downloadUrl || res?.url;
      if (url) {
        setDocPreviewUrl(url);
      } else {
        toast.error("Presigned URL expired or not available.");
      }
    } catch (err) {
      toast.error("Failed to generate presigned download URL: " + (err?.message || err));
    } finally {
      setLoadingDocUrl(false);
    }
  };

  // Submit Application Approval or Rejection
  const handleSubmitAppAction = async () => {
    if (!appActionModal?.app) return;
    const { type, app } = appActionModal;
    const appId = app.id || app.applicationId;

    if (type === "reject" && !appActionReason.trim()) {
      toast.error("Please provide a valid rejection reason.");
      return;
    }

    setAppActionSubmitting(true);
    try {
      if (type === "approve") {
        await approveRiderApplication(appId, {
          remarks: appActionReason.trim() || "Approved by Operations Admin",
          assignedHubId: app.assignedHubId,
          vehicleCategory: app.vehicleCategory,
          reviewedBy: currentUserEmail,
        });
        toast.success(`Application approved! ${app.applicantName} is now provisioned in active fleet.`);
      } else {
        await rejectRiderApplication(appId, {
          reason: appActionReason.trim(),
          reviewedBy: currentUserEmail,
        });
        toast.info(`Application for ${app.applicantName} was rejected.`);
      }

      setAppActionModal(null);
      setAppActionReason("");
      setInspectingApplication(null);
      fetchData();
    } catch (err) {
      toast.error(err?.message || "Action failed.");
    } finally {
      setAppActionSubmitting(false);
    }
  };

  // Initiate Reactivation Request
  const handleOpenCreateReactivation = (rider = null) => {
    setReactRiderTarget(rider);
    setReactDeactivationReason(rider?.dispatchEligibility?.ineligibleReason || "Temporary deactivation / safety review");
    setReactJustification("");
    setReactDocUrl("");
    setCreateReactModalOpen(true);
  };

  const handleSubmitReactivationRequest = async (e) => {
    e.preventDefault();
    if (!reactJustification.trim()) {
      toast.error("Please provide justification reason for reactivation.");
      return;
    }

    const riderId = reactRiderTarget?.riderId;
    if (!riderId) {
      toast.error("Rider ID is missing.");
      return;
    }

    setReactSubmitting(true);
    try {
      await createReactivationRequest(riderId, {
        deactivationReason: reactDeactivationReason,
        reason: reactJustification.trim(),
        supportingDocuments: reactDocUrl.trim() ? [reactDocUrl.trim()] : [],
        requestedBy: currentUserEmail,
        requestedByName: user?.displayName || "Operations Admin",
      });
      toast.success("Reactivation request submitted under Dual Control. Pending supervisor approval.");
      setCreateReactModalOpen(false);
      setActiveTab("reactivations");
      fetchData();
    } catch (err) {
      toast.error(err?.message || "Failed to submit reactivation request.");
    } finally {
      setReactSubmitting(false);
    }
  };

  // Supervisor Approval / Rejection for Reactivation (Dual Control)
  const handleSubmitReactAction = async () => {
    if (!reactActionModal?.req) return;
    const { type, req } = reactActionModal;
    const reqId = req.id || req.requestId;

    // Check dual control non-self approval
    if (type === "approve" && req.requestedBy && req.requestedBy.toLowerCase() === currentUserEmail.toLowerCase()) {
      toast.error("Dual Control Policy: You cannot supervisor-approve a reactivation request you initiated.");
      return;
    }

    if (type === "reject" && !reactNotes.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }

    setReactActionSubmitting(true);
    try {
      if (type === "approve") {
        await approveReactivationRequest(reqId, {
          currentUserEmail,
          notes: reactNotes.trim() || "Dual control supervisor approval verified.",
        });
        toast.success(`Reactivation approved! Rider ${req.riderName} restored to active dispatch.`);
      } else {
        await rejectReactivationRequest(reqId, {
          currentUserEmail,
          reason: reactNotes.trim(),
        });
        toast.info(`Reactivation request for ${req.riderName} was rejected.`);
      }

      setReactActionModal(null);
      setReactNotes("");
      fetchData();
    } catch (err) {
      toast.error(err?.message || "Supervisor action failed.");
    } finally {
      setReactActionSubmitting(false);
    }
  };

  // Open Vehicle Category Modal
  const handleOpenCategoryModal = async (rider) => {
    setCategoryModalRider(rider);
    setSelectedCategory(rider.vehicleCategory || "TWO_WHEELER");
    setMaxPayloadKg(rider.maxPayloadKg || 30);
    setMaxVolumeLiters(rider.maxVolumeLiters || 65);
    try {
      const cat = await getRiderVehicleCategory(rider.riderId);
      if (cat) {
        if (cat.vehicleCategory) setSelectedCategory(cat.vehicleCategory);
        if (cat.maxPayloadKg) setMaxPayloadKg(cat.maxPayloadKg);
        if (cat.maxVolumeLiters) setMaxVolumeLiters(cat.maxVolumeLiters);
      }
    } catch {}
  };

  // Submit Vehicle Category Update
  const handleSubmitCategory = async (e) => {
    e.preventDefault();
    if (!categoryModalRider) return;
    setCategorySubmitting(true);
    try {
      await updateRiderVehicleCategory(categoryModalRider.riderId, {
        vehicleCategory: selectedCategory,
        maxPayloadKg: Number(maxPayloadKg),
        maxVolumeLiters: Number(maxVolumeLiters),
        remarks: "Updated via Admin Hub",
      });
      toast.success(`Vehicle category for ${categoryModalRider.name} updated to ${selectedCategory}.`);
      setCategoryModalRider(null);
      fetchData();
    } catch (err) {
      toast.error(err?.message || "Failed to update vehicle category.");
    } finally {
      setCategorySubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Sub-renderers
  // ---------------------------------------------------------------------------

  return (
    <div className="riders-page">
      {/* Page Header */}
      <div className="riders-heading">
        <div className="riders-heading-title">
          <div className="riders-stat-icon-wrap blue">
            <Bike size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1>Rider & Fleet Operations</h1>
              <span className="riders-portal-tag">
                <Radio size={12} className="spin-slow" /> Live Dispatch
              </span>
            </div>
            <p>
              Manage rider onboarding KYC, Redis operational presence, fleet dispatch eligibility, and dual-control reactivations.
            </p>
          </div>
        </div>

        <div className="riders-heading-actions">
          <button
            type="button"
            className="btn-action-sm"
            onClick={fetchData}
            disabled={loading}
            title="Refresh fleet data"
          >
            <RefreshCw size={14} className={loading ? "spin-slow" : ""} />
            Refresh
          </button>
          {activeTab === "reactivations" && (
            <button
              type="button"
              className="btn-action-sm btn-action-primary"
              onClick={() => handleOpenCreateReactivation(null)}
            >
              <Plus size={14} /> Initiate Reactivation
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="riders-tab-bar">
        <button
          type="button"
          className={`riders-tab-btn ${activeTab === "fleet" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("fleet");
            setStatusFilter("ALL");
          }}
        >
          <Truck size={16} /> Fleet & Live Operations
        </button>

        <button
          type="button"
          className={`riders-tab-btn ${activeTab === "applications" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("applications");
            setStatusFilter("ALL");
          }}
        >
          <FileCheck size={16} /> Onboarding & KYC
          {pendingAppsCount > 0 && (
            <span className="riders-tab-badge badge-orange">{pendingAppsCount} pending</span>
          )}
        </button>

        <button
          type="button"
          className={`riders-tab-btn ${activeTab === "reactivations" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("reactivations");
            setStatusFilter("ALL");
          }}
        >
          <ShieldAlert size={16} /> Reactivations (Dual Control)
          {pendingReactivationsCount > 0 && (
            <span className="riders-tab-badge badge-blue">{pendingReactivationsCount} pending</span>
          )}
        </button>

        <button
          type="button"
          className={`riders-tab-btn ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("categories");
            setStatusFilter("ALL");
          }}
        >
          <Bike size={16} /> Vehicle Categories
        </button>
      </div>

      {/* TAB 1: FLEET & LIVE OPERATIONS */}
      {activeTab === "fleet" && (
        <>
          {/* KPI Cards */}
          <div className="riders-stats-grid">
            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap blue">
                <Truck size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Total Registered Fleet</span>
                <span className="riders-stat-val">{fleetRiders.length}</span>
                <span className="riders-stat-sub">Across {hubs.length} fulfillment hubs</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap green">
                <Radio size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Active Redis Presence</span>
                <span className="riders-stat-val">
                  {fleetRiders.filter((r) => r.redisPresence?.isOnline).length}
                </span>
                <span className="riders-stat-sub">Sending real-time telemetry</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap amber">
                <Zap size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">On Live Delivery</span>
                <span className="riders-stat-val">
                  {fleetRiders.filter((r) => r.operationalStatus === "ON_DELIVERY" || r.activeAssignment).length}
                </span>
                <span className="riders-stat-sub">Assigned active orders</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap rose">
                <ShieldAlert size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Dispatch Ineligible</span>
                <span className="riders-stat-val">
                  {fleetRiders.filter((r) => !r.dispatchEligibility?.isEligible).length}
                </span>
                <span className="riders-stat-sub">Offline, deact or max-load</span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="riders-filter-bar">
            <div className="riders-filter-inputs">
              <div className="riders-search-box">
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search rider name, phone, ID, vehicle..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="riders-select-box">
                <select value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
                  <option value="ALL">All Hubs</option>
                  {hubs.map((h) => (
                    <option key={h.id || h.code} value={h.id || h.code}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="riders-select-box">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Operational Statuses</option>
                  <option value="ONLINE">Online</option>
                  <option value="ON_DELIVERY">On Delivery</option>
                  <option value="BUSY">Busy / At Hub</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </div>

              <div className="riders-select-box">
                <select value={eligibilityFilter} onChange={(e) => setEligibilityFilter(e.target.value)}>
                  <option value="ALL">Dispatch Eligibility</option>
                  <option value="ELIGIBLE">Eligible Only</option>
                  <option value="INELIGIBLE">Ineligible Only</option>
                </select>
              </div>

              <div className="riders-select-box">
                <select value={vehicleCatFilter} onChange={(e) => setVehicleCatFilter(e.target.value)}>
                  <option value="ALL">All Vehicle Types</option>
                  <option value="TWO_WHEELER">2-Wheeler (Bike)</option>
                  <option value="ELECTRIC_2W">Electric 2W (EV)</option>
                  <option value="THREE_WHEELER">3-Wheeler (Cargo)</option>
                  <option value="FOUR_WHEELER">4-Wheeler (Van)</option>
                </select>
              </div>
            </div>

            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              Showing {fleetRiders.length} riders
            </span>
          </div>

          {/* Fleet Table */}
          <div className="riders-card">
            <div className="riders-table-wrap">
              <table className="riders-table">
                <thead>
                  <tr>
                    <th>Rider Profile</th>
                    <th>Hub / City</th>
                    <th>Operational Status</th>
                    <th>Redis Presence</th>
                    <th>Dispatch Eligibility</th>
                    <th>Active Assignment</th>
                    <th>Vehicle & Battery</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && fleetRiders.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="loading-box">
                          <RefreshCw size={24} className="spin-slow" />
                          <span>Streaming real-time dispatcher telemetry...</span>
                        </div>
                      </td>
                    </tr>
                  ) : fleetRiders.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty-state">
                          <Truck size={40} />
                          <h4>No riders found</h4>
                          <p>Try adjusting your search criteria, hub selection, or status filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    fleetRiders.map((rider) => {
                      const isOnline = rider.redisPresence?.isOnline;
                      const opStatus = (rider.operationalStatus || "OFFLINE").toLowerCase();
                      const isEligible = Boolean(rider.dispatchEligibility?.isEligible);

                      return (
                        <tr key={rider.riderId}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 700, color: "#0f172a" }}>{rider.name}</span>
                              <span style={{ fontSize: 11.5, color: "#64748b" }}>{rider.phone}</span>
                              <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                                {rider.riderId}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600 }}>{rider.hubName || "Hub Default"}</span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                Rating: ⭐ {rider.rating || "5.0"} ({rider.completedDeliveriesToday || 0} today)
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`operational-badge ${opStatus}`}>
                              <span className="dot" />
                              {rider.operationalStatus?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>
                            <span className={`redis-pill ${isOnline ? "active" : "inactive"}`}>
                              <Radio size={12} />
                              {isOnline ? `TTL: ${rider.redisPresence?.ttlSeconds}s` : "No Heartbeat"}
                            </span>
                          </td>
                          <td>
                            <span className={`dispatch-pill ${isEligible ? "eligible" : "ineligible"}`}>
                              {isEligible ? (
                                <>
                                  <CheckCircle2 size={13} /> Eligible
                                </>
                              ) : (
                                <>
                                  <AlertTriangle size={13} /> {rider.dispatchEligibility?.ineligibleReason || "Ineligible"}
                                </>
                              )}
                            </span>
                          </td>
                          <td>
                            {rider.activeAssignment ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontWeight: 700, color: "#2563eb", fontSize: 12 }}>
                                  {rider.activeAssignment.orderId}
                                </span>
                                <span style={{ fontSize: 11, color: "#64748b" }}>
                                  Pin: {rider.activeAssignment.deliveryPincode} • {rider.activeAssignment.status}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>None (Available)</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span className="vehicle-cat-tag">
                                <Bike size={12} /> {rider.vehicleCategory?.replace(/_/g, " ")}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                {rider.vehicleNumber} • 🔋 {rider.batteryLevel ?? "--"}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                type="button"
                                className="btn-action-sm"
                                onClick={() => handleOpenCategoryModal(rider)}
                                title="Edit Vehicle Category"
                              >
                                <Edit2 size={12} /> Capacity
                              </button>
                              {!isEligible && (
                                <button
                                  type="button"
                                  className="btn-action-sm btn-action-primary"
                                  onClick={() => handleOpenCreateReactivation(rider)}
                                  title="Initiate Dual Control Reactivation"
                                >
                                  Reactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: ONBOARDING & KYC REVIEW */}
      {activeTab === "applications" && (
        <>
          {/* KPI Cards */}
          <div className="riders-stats-grid">
            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap amber">
                <Clock size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Pending KYC Review</span>
                <span className="riders-stat-val">
                  {applications.filter((a) => a.status === "PENDING").length}
                </span>
                <span className="riders-stat-sub">Requires admin validation</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap blue">
                <FileCheck size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Total Applications</span>
                <span className="riders-stat-val">{applications.length}</span>
                <span className="riders-stat-sub">All onboarding submissions</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap green">
                <CheckCircle2 size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Approved & Active</span>
                <span className="riders-stat-val">
                  {applications.filter((a) => a.status === "APPROVED").length}
                </span>
                <span className="riders-stat-sub">Provisioned into fleet</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap rose">
                <XCircle size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Rejected Applications</span>
                <span className="riders-stat-val">
                  {applications.filter((a) => a.status === "REJECTED").length}
                </span>
                <span className="riders-stat-sub">Failed verification</span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="riders-filter-bar">
            <div className="riders-filter-inputs">
              <div className="riders-search-box">
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search applicant name, phone, city, ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="riders-select-box">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Application Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved & Provisioned</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              Showing {applications.length} applications
            </span>
          </div>

          {/* Applications Table */}
          <div className="riders-card">
            <div className="riders-table-wrap">
              <table className="riders-table">
                <thead>
                  <tr>
                    <th>Applicant Details</th>
                    <th>City & Assigned Hub</th>
                    <th>Vehicle Details</th>
                    <th>License & Expiry</th>
                    <th>Submitted On</th>
                    <th>Review Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && applications.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="loading-box">
                          <RefreshCw size={24} className="spin-slow" />
                          <span>Loading rider applications...</span>
                        </div>
                      </td>
                    </tr>
                  ) : applications.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <FileCheck size={40} />
                          <h4>No applications found</h4>
                          <p>No rider applications match the selected status or query.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => {
                      const isPending = app.status === "PENDING";
                      const isApproved = app.status === "APPROVED";

                      return (
                        <tr key={app.id || app.applicationId}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 700, color: "#0f172a" }}>{app.applicantName}</span>
                              <span style={{ fontSize: 12, color: "#475569" }}>{app.phone}</span>
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>{app.email}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600 }}>{app.city}</span>
                              <span style={{ fontSize: 11.5, color: "#64748b" }}>{app.hubName}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span className="vehicle-cat-tag">
                                <Bike size={12} /> {app.vehicleCategory?.replace(/_/g, " ")}
                              </span>
                              <span style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                                {app.vehicleNumber} ({app.vehicleModel || "Standard"})
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 12 }}>
                                {app.drivingLicenseNumber}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                Exp: {app.licenseExpiry || "N/A"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: "#475569" }}>
                              {formatDateTime(app.submittedAt)}
                            </span>
                          </td>
                          <td>
                            {isPending ? (
                              <span className="operational-badge busy">
                                <Clock size={11} /> Pending Review
                              </span>
                            ) : isApproved ? (
                              <span className="operational-badge online">
                                <Check size={11} /> Approved
                              </span>
                            ) : (
                              <span className="operational-badge offline" style={{ color: "#dc2626", borderColor: "#fca5a5" }}>
                                <X size={11} /> Rejected
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                type="button"
                                className="btn-action-sm btn-action-primary"
                                onClick={() => handleInspectApp(app)}
                                title="Inspect KYC Documents"
                              >
                                <Eye size={13} /> Review KYC
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: REACTIVATIONS (DUAL CONTROL) */}
      {activeTab === "reactivations" && (
        <>
          {/* Dual Control Information Notice */}
          <div className="dual-control-callout">
            <Lock size={20} />
            <div>
              <strong>Dual Control Separation of Duties Enforced:</strong> Reactivation of de-activated or safety-held riders requires dual control under compliance rules. The operations team member who initiates a reactivation request cannot approve it. An authorized supervisor must independently verify the retraining or compliance resolution before final approval.
            </div>
          </div>

          {/* KPI Cards */}
          <div className="riders-stats-grid">
            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap amber">
                <Clock size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Pending Dual Control</span>
                <span className="riders-stat-val">
                  {reactivations.filter((r) => r.status === "PENDING").length}
                </span>
                <span className="riders-stat-sub">Awaiting supervisor sign-off</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap blue">
                <ShieldCheck size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Total Reactivation Requests</span>
                <span className="riders-stat-val">{reactivations.length}</span>
                <span className="riders-stat-sub">Audit trail records</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap green">
                <CheckCircle2 size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Approved & Restored</span>
                <span className="riders-stat-val">
                  {reactivations.filter((r) => r.status === "APPROVED").length}
                </span>
                <span className="riders-stat-sub">Supervisor signed off</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap rose">
                <XCircle size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Rejected Requests</span>
                <span className="riders-stat-val">
                  {reactivations.filter((r) => r.status === "REJECTED").length}
                </span>
                <span className="riders-stat-sub">Did not meet standards</span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="riders-filter-bar">
            <div className="riders-filter-inputs">
              <div className="riders-select-box">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Reactivation Statuses</option>
                  <option value="PENDING">Pending Supervisor Approval</option>
                  <option value="APPROVED">Supervisor Approved</option>
                  <option value="REJECTED">Supervisor Rejected</option>
                </select>
              </div>
            </div>

            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              Showing {reactivations.length} reactivation requests
            </span>
          </div>

          {/* Reactivations Table */}
          <div className="riders-card">
            <div className="riders-table-wrap">
              <table className="riders-table">
                <thead>
                  <tr>
                    <th>Request ID & Rider</th>
                    <th>Deactivation Reason</th>
                    <th>Reactivation Justification</th>
                    <th>Initiated By</th>
                    <th>Status</th>
                    <th>Supervisor Review</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && reactivations.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="loading-box">
                          <RefreshCw size={24} className="spin-slow" />
                          <span>Loading reactivation requests...</span>
                        </div>
                      </td>
                    </tr>
                  ) : reactivations.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <ShieldCheck size={40} />
                          <h4>No reactivation requests</h4>
                          <p>All riders are in good standing or no pending dual control requests.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reactivations.map((req) => {
                      const isPending = req.status === "PENDING";
                      const isApproved = req.status === "APPROVED";
                      const isSelfInitiated =
                        req.requestedBy && req.requestedBy.toLowerCase() === currentUserEmail.toLowerCase();

                      return (
                        <tr key={req.id || req.requestId}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 700, color: "#0f172a" }}>{req.riderName}</span>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                                {req.riderId} • {req.id || req.requestId}
                              </span>
                              <span style={{ fontSize: 11.5, color: "#475569" }}>{req.riderPhone}</span>
                            </div>
                          </td>
                          <td style={{ maxWidth: 220 }}>
                            <span style={{ fontSize: 12.5, color: "#475569" }}>
                              {req.deactivationReason}
                            </span>
                          </td>
                          <td style={{ maxWidth: 240 }}>
                            <span style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 500 }}>
                              {req.reactivationReason}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600, fontSize: 12 }}>
                                {req.requestedByName || req.requestedBy}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                {formatDateTime(req.requestedAt)}
                              </span>
                              {isSelfInitiated && (
                                <span style={{ fontSize: 10.5, color: "#d97706", fontWeight: 700 }}>
                                  (Initiated by you)
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {isPending ? (
                              <span className="operational-badge busy">
                                <Clock size={11} /> Pending Dual Control
                              </span>
                            ) : isApproved ? (
                              <span className="operational-badge online">
                                <Check size={11} /> Approved
                              </span>
                            ) : (
                              <span className="operational-badge offline" style={{ color: "#dc2626" }}>
                                <X size={11} /> Rejected
                              </span>
                            )}
                          </td>
                          <td>
                            {req.reviewedBy ? (
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontWeight: 600, fontSize: 12 }}>{req.reviewedBy}</span>
                                <span style={{ fontSize: 11, color: "#64748b" }}>
                                  {formatDateTime(req.reviewedAt)}
                                </span>
                                {req.reviewNotes && (
                                  <span style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>
                                    "{req.reviewNotes}"
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>Awaiting Supervisor</span>
                            )}
                          </td>
                          <td>
                            {isPending && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn-action-sm btn-action-success"
                                  onClick={() => setReactActionModal({ type: "approve", req })}
                                  disabled={isSelfInitiated}
                                  title={
                                    isSelfInitiated
                                      ? "Dual Control: You initiated this request. A second supervisor must approve."
                                      : "Supervisor Approve Reactivation"
                                  }
                                >
                                  <ShieldCheck size={13} /> Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn-action-sm btn-action-danger"
                                  onClick={() => setReactActionModal({ type: "reject", req })}
                                  title="Reject Reactivation"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 4: VEHICLE & CAPACITY CATEGORIES */}
      {activeTab === "categories" && (
        <>
          <div className="riders-stats-grid">
            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap blue">
                <Bike size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Two Wheeler Fleet</span>
                <span className="riders-stat-val">
                  {fleetRiders.filter((r) => r.vehicleCategory === "TWO_WHEELER").length}
                </span>
                <span className="riders-stat-sub">Standard bikes & scooters</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap green">
                <Zap size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Electric Fleet (EV)</span>
                <span className="riders-stat-val">
                  {fleetRiders.filter((r) => r.vehicleCategory === "ELECTRIC_2W").length}
                </span>
                <span className="riders-stat-sub">Zero-emission delivery</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap amber">
                <Truck size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Three Wheeler Cargo</span>
                <span className="riders-stat-val">
                  {fleetRiders.filter((r) => r.vehicleCategory === "THREE_WHEELER").length}
                </span>
                <span className="riders-stat-sub">High-volume payload capacity</span>
              </div>
            </div>

            <div className="riders-stat-card">
              <div className="riders-stat-icon-wrap purple">
                <ShieldCheck size={20} />
              </div>
              <div className="riders-stat-content">
                <span className="riders-stat-label">Capacity Compliance</span>
                <span className="riders-stat-val">100%</span>
                <span className="riders-stat-sub">Registered with dimensions</span>
              </div>
            </div>
          </div>

          <div className="riders-card">
            <div className="riders-table-wrap">
              <table className="riders-table">
                <thead>
                  <tr>
                    <th>Rider</th>
                    <th>Registered Vehicle Category</th>
                    <th>Vehicle Plate Number</th>
                    <th>Max Payload (Kg)</th>
                    <th>Max Volume (Liters)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fleetRiders.map((rider) => (
                    <tr key={rider.riderId}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{rider.name}</span>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                            {rider.riderId}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="vehicle-cat-tag">
                          <Bike size={13} /> {rider.vehicleCategory?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                          {rider.vehicleNumber}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700 }}>{rider.maxPayloadKg || 30} kg</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700 }}>{rider.maxVolumeLiters || 65} L</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-action-sm btn-action-primary"
                          onClick={() => handleOpenCategoryModal(rider)}
                        >
                          <Edit2 size={12} /> Configure Capacity
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: KYC INSPECTION DRAWER */}
      {/* --------------------------------------------------------------------- */}
      {inspectingApplication && (
        <div className="modal-overlay" onClick={() => setInspectingApplication(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 680 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileCheck size={20} color="#2563eb" />
                <h3>KYC Application Review: {inspectingApplication.applicantName}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInspectingApplication(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {loadingAppDetail ? (
                <div className="loading-box">
                  <RefreshCw size={24} className="spin-slow" />
                  <span>Decrypting PII & loading document vault...</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="doc-card">
                      <span className="riders-stat-label">Contact & City</span>
                      <span style={{ fontWeight: 700 }}>{inspectingApplication.phone}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{inspectingApplication.email}</span>
                      <span style={{ fontSize: 12, color: "#0f172a", marginTop: 4 }}>
                        City: {inspectingApplication.city}
                      </span>
                    </div>

                    <div className="doc-card">
                      <span className="riders-stat-label">Assigned Hub & Vehicle</span>
                      <span style={{ fontWeight: 700 }}>{inspectingApplication.hubName}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {inspectingApplication.vehicleCategory} • {inspectingApplication.vehicleNumber}
                      </span>
                      <span style={{ fontSize: 12, color: "#0f172a", marginTop: 4 }}>
                        DL: {inspectingApplication.drivingLicenseNumber}
                      </span>
                    </div>
                  </div>

                  {inspectingApplication.emergencyContact && (
                    <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", padding: 8, borderRadius: 6 }}>
                      <strong>Emergency Contact:</strong> {inspectingApplication.emergencyContact}
                    </div>
                  )}

                  {/* Documents with 15-min Presigned Download URLs */}
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>
                      KYC Documents Verification (15-min Pre-signed URLs)
                    </h4>
                    <div className="doc-cards-grid">
                      {(inspectingApplication.documents || [
                        { type: "AADHAAR_FRONT", name: "Aadhaar Card (Front)" },
                        { type: "AADHAAR_BACK", name: "Aadhaar Card (Back)" },
                        { type: "PAN_CARD", name: "PAN Card" },
                        { type: "DRIVING_LICENSE", name: "Driving License" },
                        { type: "VEHICLE_RC", name: "Vehicle RC" },
                      ]).map((doc) => (
                        <div key={doc.type} className="doc-card">
                          <div className="doc-card-header">
                            <span className="doc-card-name">{doc.name || doc.type}</span>
                            <span
                              className={`operational-badge ${
                                doc.status === "VERIFIED" ? "online" : "busy"
                              }`}
                              style={{ fontSize: 10, padding: "2px 6px" }}
                            >
                              {doc.status || "PENDING"}
                            </span>
                          </div>
                          <div className="doc-card-actions">
                            <button
                              type="button"
                              className="btn-action-sm btn-action-primary"
                              style={{ width: "100%", justifyContent: "center" }}
                              onClick={() => handleViewDocUrl(inspectingApplication.id || inspectingApplication.applicationId, doc.type)}
                              disabled={loadingDocUrl}
                            >
                              <ExternalLink size={12} /> View Secure Doc
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-action-sm btn-action-danger"
                onClick={() => setAppActionModal({ type: "reject", app: inspectingApplication })}
              >
                <XCircle size={14} /> Reject Application
              </button>
              <button
                type="button"
                className="btn-action-sm btn-action-success"
                onClick={() => setAppActionModal({ type: "approve", app: inspectingApplication })}
              >
                <CheckCircle2 size={14} /> Approve & Provision Rider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: DOCUMENT PREVIEW (PRESIGNED URL) */}
      {/* --------------------------------------------------------------------- */}
      {docPreviewUrl && (
        <div className="modal-overlay" onClick={() => setDocPreviewUrl(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 700, padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>KYC Document Preview (Secure Pre-signed URL)</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDocPreviewUrl(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 16, background: "#0f172a", textAlign: "center" }}>
              <img
                src={docPreviewUrl}
                alt="Document Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "65vh",
                  borderRadius: 8,
                  objectFit: "contain",
                }}
              />
            </div>
            <div className="modal-footer">
              <a
                href={docPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-action-sm btn-action-primary"
              >
                <ExternalLink size={13} /> Open in New Window
              </a>
              <button
                type="button"
                className="btn-action-sm"
                onClick={() => setDocPreviewUrl(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: APPROVE / REJECT APPLICATION */}
      {/* --------------------------------------------------------------------- */}
      {appActionModal && (
        <div className="modal-overlay" onClick={() => setAppActionModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {appActionModal.type === "approve"
                  ? "Approve Rider Application"
                  : "Reject Rider Application"}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAppActionModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                {appActionModal.type === "approve"
                  ? `Are you sure you want to approve ${appActionModal.app.applicantName}? This will provision an active rider profile in the fleet management system.`
                  : `Please specify the reason for rejecting ${appActionModal.app.applicantName}'s application. This will be recorded for compliance audit.`}
              </p>

              <div className="form-group">
                <label>
                  {appActionModal.type === "approve"
                    ? "Approval Remarks (Optional)"
                    : "Rejection Reason (Required)"}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    appActionModal.type === "approve"
                      ? "e.g. All documents verified against original portal."
                      : "e.g. License expired, blurry Aadhaar card image."
                  }
                  value={appActionReason}
                  onChange={(e) => setAppActionReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-action-sm"
                onClick={() => setAppActionModal(null)}
                disabled={appActionSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn-action-sm ${
                  appActionModal.type === "approve" ? "btn-action-success" : "btn-action-danger"
                }`}
                onClick={handleSubmitAppAction}
                disabled={appActionSubmitting}
              >
                {appActionSubmitting
                  ? "Processing..."
                  : appActionModal.type === "approve"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: INITIATE REACTIVATION REQUEST (DUAL CONTROL) */}
      {/* --------------------------------------------------------------------- */}
      {createReactModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateReactModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitReactivationRequest}>
              <div className="modal-header">
                <h3>Initiate Rider Reactivation Request (Dual Control)</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setCreateReactModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="dual-control-callout" style={{ margin: 0 }}>
                  <ShieldAlert size={16} />
                  <span>
                    Initiating this request logs your identity as requester. Under Dual Control policy, a separate supervisor will review and approve.
                  </span>
                </div>

                <div className="form-group">
                  <label>Select Inactive / Suspended Rider</label>
                  <select
                    value={reactRiderTarget?.riderId || ""}
                    onChange={(e) => {
                      const match = fleetRiders.find((r) => r.riderId === e.target.value);
                      setReactRiderTarget(match || null);
                      setReactDeactivationReason(
                        match?.dispatchEligibility?.ineligibleReason || "Temporary deactivation / safety review"
                      );
                    }}
                    required
                  >
                    <option value="">-- Choose Rider --</option>
                    {fleetRiders.map((r) => (
                      <option key={r.riderId} value={r.riderId}>
                        {r.name} ({r.riderId} - {r.operationalStatus})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Deactivation Reason</label>
                  <input
                    type="text"
                    value={reactDeactivationReason}
                    onChange={(e) => setReactDeactivationReason(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Reactivation Justification</label>
                  <textarea
                    rows={3}
                    placeholder="Describe remedial actions, training completed, or updated documentation..."
                    value={reactJustification}
                    onChange={(e) => setReactJustification(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Supporting Evidence / Document URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={reactDocUrl}
                    onChange={(e) => setReactDocUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-action-sm"
                  onClick={() => setCreateReactModalOpen(false)}
                  disabled={reactSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-action-sm btn-action-primary"
                  disabled={reactSubmitting}
                >
                  {reactSubmitting ? "Submitting..." : "Submit for Supervisor Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: SUPERVISOR APPROVE / REJECT REACTIVATION */}
      {/* --------------------------------------------------------------------- */}
      {reactActionModal && (
        <div className="modal-overlay" onClick={() => setReactActionModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {reactActionModal.type === "approve"
                  ? "Supervisor Approval: Reactivate Rider"
                  : "Supervisor Rejection: Reactivation Request"}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setReactActionModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                <strong>Rider:</strong> {reactActionModal.req.riderName} ({reactActionModal.req.riderId})
                <br />
                <strong>Initiated By:</strong> {reactActionModal.req.requestedBy}
                <br />
                <strong>Reason:</strong> {reactActionModal.req.reactivationReason}
              </p>

              <div className="form-group">
                <label>
                  {reactActionModal.type === "approve"
                    ? "Supervisor Verification Notes"
                    : "Rejection Reason"}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    reactActionModal.type === "approve"
                      ? "e.g. In-person safety assessment verified. Compliance approval granted."
                      : "e.g. Training certificate incomplete."
                  }
                  value={reactNotes}
                  onChange={(e) => setReactNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-action-sm"
                onClick={() => setReactActionModal(null)}
                disabled={reactActionSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn-action-sm ${
                  reactActionModal.type === "approve" ? "btn-action-success" : "btn-action-danger"
                }`}
                onClick={handleSubmitReactAction}
                disabled={reactActionSubmitting}
              >
                {reactActionSubmitting
                  ? "Processing..."
                  : reactActionModal.type === "approve"
                  ? "Grant Supervisor Approval"
                  : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CONFIGURE VEHICLE CATEGORY */}
      {/* --------------------------------------------------------------------- */}
      {categoryModalRider && (
        <div className="modal-overlay" onClick={() => setCategoryModalRider(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitCategory}>
              <div className="modal-header">
                <h3>Configure Vehicle Category & Capacity</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setCategoryModalRider(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                  Set registered vehicle category and dispatch payload boundaries for{" "}
                  <strong>{categoryModalRider.name}</strong> ({categoryModalRider.riderId}).
                </p>

                <div className="form-group">
                  <label>Vehicle Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCategory(val);
                      if (val === "THREE_WHEELER") {
                        setMaxPayloadKg(250);
                        setMaxVolumeLiters(800);
                      } else if (val === "FOUR_WHEELER") {
                        setMaxPayloadKg(750);
                        setMaxVolumeLiters(2500);
                      } else if (val === "CYCLE") {
                        setMaxPayloadKg(10);
                        setMaxVolumeLiters(25);
                      } else {
                        setMaxPayloadKg(30);
                        setMaxVolumeLiters(65);
                      }
                    }}
                  >
                    <option value="TWO_WHEELER">Two Wheeler (Standard Motorbike/Scooter)</option>
                    <option value="ELECTRIC_2W">Electric 2-Wheeler (EV Bike)</option>
                    <option value="THREE_WHEELER">Three Wheeler (Cargo Auto / E-Rickshaw)</option>
                    <option value="FOUR_WHEELER">Four Wheeler (Mini Van / Truck)</option>
                    <option value="CYCLE">Bicycle (Ultra Local / Campus)</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label>Max Payload (Kg)</label>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={maxPayloadKg}
                      onChange={(e) => setMaxPayloadKg(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Volume (Liters)</label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={maxVolumeLiters}
                      onChange={(e) => setMaxVolumeLiters(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-action-sm"
                  onClick={() => setCategoryModalRider(null)}
                  disabled={categorySubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-action-sm btn-action-primary"
                  disabled={categorySubmitting}
                >
                  {categorySubmitting ? "Updating..." : "Save Vehicle Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
