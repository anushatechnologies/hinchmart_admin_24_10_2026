import { useState, useEffect, useMemo } from "react";
import {
  Percent,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Edit2,
  Trash2,
  Globe,
  FolderTree,
  ShieldCheck,
  Calendar,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Info,
  Check,
  X,
  History,
} from "lucide-react";
import {
  getCommissionRules,
  createCommissionRule,
  updateCommissionRule,
  toggleCommissionRuleStatus,
  deleteCommissionRule,
} from "../api/commissionRuleApi";
import { getCategories } from "../api/categoryApi";
import { useToast } from "../components/ToastContext";
import "../styles/pages.css";
import "../styles/products.css";
import "../styles/commissionRules.css";

const PRESET_RATES = [2.5, 5.0, 7.5, 10.0, 12.5, 15.0];

export default function CommissionRules() {
  const toast = useToast();

  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL"); // ALL | GLOBAL | categoryId
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | ACTIVE | INACTIVE

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);

  // Form State
  const [formScope, setFormScope] = useState("GLOBAL"); // GLOBAL | CATEGORY
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formRate, setFormRate] = useState("7.50");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [formEffectiveTo, setFormEffectiveTo] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch data
  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const [rulesData, catsData] = await Promise.allSettled([
        getCommissionRules(),
        getCategories(),
      ]);

      if (rulesData.status === "fulfilled") {
        setRules(rulesData.value || []);
      }
      if (catsData.status === "fulfilled") {
        setCategories(catsData.value || []);
      }
    } catch (err) {
      console.error("Failed to load commission rules:", err);
      toast?.error("Failed to load commission rules.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // Search filter
      const q = search.trim().toLowerCase();
      if (q) {
        const matchName = (rule.categoryName || "").toLowerCase().includes(q);
        const matchId = String(rule.id).includes(q);
        const matchRate = String(rule.rate).includes(q);
        if (!matchName && !matchId && !matchRate) return false;
      }

      // Category filter
      if (categoryFilter === "GLOBAL" && rule.categoryId !== null) {
        return false;
      } else if (
        categoryFilter !== "ALL" &&
        categoryFilter !== "GLOBAL" &&
        String(rule.categoryId) !== String(categoryFilter)
      ) {
        return false;
      }

      // Status filter
      if (statusFilter === "ACTIVE" && !rule.isActive) return false;
      if (statusFilter === "INACTIVE" && rule.isActive) return false;

      return true;
    });
  }, [rules, search, categoryFilter, statusFilter]);

  // Metrics
  const activeGlobalRule = useMemo(() => {
    return rules.find((r) => r.categoryId === null && r.isActive);
  }, [rules]);

  const activeCategoryRulesCount = useMemo(() => {
    return rules.filter((r) => r.categoryId !== null && r.isActive).length;
  }, [rules]);

  const totalRulesCount = rules.length;

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormScope("GLOBAL");
    setFormCategoryId("");
    setFormRate(activeGlobalRule ? String(activeGlobalRule.rate) : "7.50");
    setFormEffectiveFrom(new Date().toISOString().slice(0, 10));
    setFormEffectiveTo("");
    setFormIsActive(true);
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    setFormScope(rule.categoryId === null ? "GLOBAL" : "CATEGORY");
    setFormCategoryId(rule.categoryId !== null ? String(rule.categoryId) : "");
    setFormRate(String(rule.rate));
    setFormEffectiveFrom(
      rule.effectiveFrom ? rule.effectiveFrom.slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    setFormEffectiveTo(rule.effectiveTo ? rule.effectiveTo.slice(0, 10) : "");
    setFormIsActive(rule.isActive);
    setShowModal(true);
  };

  // Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const rateNum = parseFloat(formRate);

    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      toast?.error("Please enter a valid rate between 0.00% and 100.00%");
      return;
    }

    if (formScope === "CATEGORY" && !formCategoryId) {
      toast?.error("Please select a category for this category-specific rule.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        categoryId: formScope === "CATEGORY" ? Number(formCategoryId) : null,
        rate: rateNum,
        effectiveFrom: formEffectiveFrom ? `${formEffectiveFrom}T00:00:00` : new Date().toISOString(),
        effectiveTo: formEffectiveTo ? `${formEffectiveTo}T23:59:59` : null,
        isActive: formIsActive,
      };

      if (editingRule) {
        await updateCommissionRule(editingRule.id, payload);
        toast?.success(`Holding fee rule #${editingRule.id} updated successfully.`);
      } else {
        await createCommissionRule(payload);
        toast?.success(
          formScope === "GLOBAL"
            ? "New Global Holding Fee rule created and prior global rules deactivated."
            : "Category-specific commission rule created successfully."
        );
      }

      setShowModal(false);
      await fetchData(true);
    } catch (err) {
      console.error("Save rule error:", err);
      toast?.error(err.response?.data?.message || err.message || "Failed to save rule.");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (rule, e) => {
    e.stopPropagation();
    const newStatus = !rule.isActive;
    try {
      await toggleCommissionRuleStatus(rule.id, newStatus);
      toast?.success(
        `Rule #${rule.id} marked as ${newStatus ? "ACTIVE" : "INACTIVE"}.`
      );
      await fetchData(true);
    } catch (err) {
      toast?.error("Failed to toggle rule status.");
    }
  };

  // Soft Deactivate
  const handleDelete = async (rule) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to soft-deactivate Rule #${rule.id} (${rule.categoryName})?\n\nThis will set isActive = false and set effectiveTo to current time, preserving audit records.`
    );
    if (!isConfirmed) return;

    try {
      await deleteCommissionRule(rule.id);
      toast?.success(`Rule #${rule.id} soft-deactivated successfully.`);
      await fetchData(true);
    } catch (err) {
      toast?.error("Failed to deactivate rule.");
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb" style={{ marginBottom: "6px" }}>
            <span>Admin</span> / <span>Commerce</span> / <span>Holding Fee Rules</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ margin: 0 }}>Holding Fee & Commission Rules</h1>
            <span
              style={{
                background: "#f0fdf4",
                color: "#16a34a",
                border: "1px solid #bbf7d0",
                fontSize: "12px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              API Active
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: "4px 0 0 0" }}>
            Configure marketplace holding fee ($X%) with audit-safe global fallback and category overrides.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowAuditDrawer(true)}
            title="View historical changes and audit trail"
          >
            <History size={16} />
            <span>Audit History</span>
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            title="Refresh rules from server"
          >
            <RotateCcw size={16} className={refreshing ? "spin" : ""} />
            <span>{refreshing ? "Syncing..." : "Sync"}</span>
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleOpenCreate}
          >
            <Plus size={16} />
            <span>Configure Rule</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="commission-metrics-grid">
        <div className="commission-metric-card highlight">
          <div className="metric-info">
            <span className="metric-title">Active Global Holding Fee</span>
            <span className="metric-value">
              {activeGlobalRule ? `${activeGlobalRule.rate.toFixed(2)}%` : "Not Set"}
            </span>
            <span className="metric-sub">
              <Globe size={13} /> Default platform fallback rate
            </span>
          </div>
          <div className="metric-icon-box">
            <Percent size={22} />
          </div>
        </div>

        <div className="commission-metric-card">
          <div className="metric-info">
            <span className="metric-title">Category Overrides</span>
            <span className="metric-value">{activeCategoryRulesCount}</span>
            <span className="metric-sub">
              <FolderTree size={13} /> Active specific category rates
            </span>
          </div>
          <div className="metric-icon-box" style={{ background: "#fef3c7", color: "#b45309" }}>
            <FolderTree size={22} />
          </div>
        </div>

        <div className="commission-metric-card">
          <div className="metric-info">
            <span className="metric-title">Audit Trail Records</span>
            <span className="metric-value">{totalRulesCount}</span>
            <span className="metric-sub">
              <ShieldCheck size={13} /> Active + expired historical rules
            </span>
          </div>
          <div className="metric-icon-box" style={{ background: "#ecfdf5", color: "#059669" }}>
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* Audit Safeguard Info Strip */}
      <div className="safeguard-banner">
        <ShieldCheck size={20} color="#16a34a" style={{ flexShrink: 0 }} />
        <div>
          <strong>Audit Safeguard Active:</strong> Activating a global holding fee rule automatically
          expires and deactivates prior active global rules, ensuring rate determinism without ambiguity.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div className="search-input-wrapper" style={{ flex: "1 1 240px", minWidth: "220px" }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search category, rule ID, or rate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Scope / Category Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Filter size={15} style={{ color: "#64748b" }} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Rule Scopes</option>
              <option value="GLOBAL">Global Fallback Only</option>
              {categories.map((cat) => (
                <option key={cat.id || cat.categoryId} value={cat.id || cat.categoryId}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive / Expired</option>
          </select>

          {(search || categoryFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSearch("");
                setCategoryFilter("ALL");
                setStatusFilter("ALL");
              }}
              style={{ fontSize: "13px", color: "#64748b" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Rules Table */}
      <div className="data-table-container">
        {loading ? (
          <div className="table-loading">
            <div className="spinner"></div>
            <p>Loading holding fee and commission rules...</p>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="table-empty">
            <Percent size={40} style={{ color: "#94a3b8", marginBottom: "12px" }} />
            <h3>No Commission Rules Found</h3>
            <p style={{ color: "#64748b", maxWidth: "400px", margin: "4px auto 16px" }}>
              {search || categoryFilter !== "ALL" || statusFilter !== "ALL"
                ? "No rules match your selected filters. Try resetting the filters."
                : "No holding fee rules have been configured yet. Create a global fallback rule to get started."}
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={handleOpenCreate}
            >
              <Plus size={16} />
              <span>Create First Rule</span>
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "90px" }}>Rule ID</th>
                <th>Scope & Category</th>
                <th>Holding Fee Rate (%)</th>
                <th>Effective Window</th>
                <th style={{ width: "130px" }}>Status</th>
                <th>Audit Info</th>
                <th style={{ textAlign: "right", width: "130px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => {
                const isGlobal = rule.categoryId === null;
                const fromFormatted = rule.effectiveFrom
                  ? new Date(rule.effectiveFrom).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Immediate";
                const toFormatted = rule.effectiveTo
                  ? new Date(rule.effectiveTo).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Indefinite";

                return (
                  <tr key={rule.id} className={!rule.isActive ? "row-inactive" : ""}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#64748b" }}>
                        #{rule.id}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {isGlobal ? (
                          <span className="scope-pill global">
                            <Globe size={11} /> Global
                          </span>
                        ) : (
                          <span className="scope-pill category">
                            <FolderTree size={11} /> Category
                          </span>
                        )}
                        <div>
                          <strong style={{ color: "#0f172a", fontSize: "0.9rem" }}>
                            {rule.categoryName || "Global Fallback"}
                          </strong>
                          {isGlobal && (
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              Applies to all products without custom category rate
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`rate-badge ${isGlobal ? "global" : ""}`}>
                        <Percent size={13} />
                        {rule.rate.toFixed(2)}%
                      </span>
                    </td>

                    <td>
                      <div style={{ fontSize: "12px", color: "#334155" }}>
                        <div>
                          <span style={{ color: "#64748b" }}>From: </span>
                          <strong>{fromFormatted}</strong>
                        </div>
                        <div>
                          <span style={{ color: "#64748b" }}>To: </span>
                          <span style={{ color: rule.effectiveTo ? "#b45309" : "#16a34a" }}>
                            {toFormatted}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label className="rule-switch" title={rule.isActive ? "Click to deactivate" : "Click to activate"}>
                          <input
                            type="checkbox"
                            checked={rule.isActive}
                            onChange={(e) => handleToggleStatus(rule, e)}
                          />
                          <span className="rule-slider"></span>
                        </label>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: rule.isActive ? "#10b981" : "#94a3b8",
                          }}
                        >
                          {rule.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        <div>Updated: {new Date(rule.updatedAt || rule.createdAt).toLocaleDateString()}</div>
                        <div style={{ color: "#94a3b8" }}>
                          {new Date(rule.updatedAt || rule.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="table-action-btn edit"
                          onClick={() => handleOpenEdit(rule)}
                          title="Edit rule parameters"
                        >
                          <Edit2 size={15} />
                        </button>

                        <button
                          type="button"
                          className="table-action-btn delete"
                          onClick={() => handleDelete(rule)}
                          title="Soft deactivate rule"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "540px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "#e0f2fe",
                    color: "#0284c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Percent size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>
                    {editingRule ? `Edit Rule #${editingRule.id}` : "Configure Holding Fee Rule"}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    REST API: POST/PUT /api/admin/commission-rules
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="modal-form">
              {/* Scope Selection */}
              <div className="form-group">
                <label>Rule Scope <strong style={{ color: "#ef4444" }}>*</strong></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormScope("GLOBAL");
                      setFormCategoryId("");
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: formScope === "GLOBAL" ? "2px solid #0284c7" : "1px solid #cbd5e1",
                      background: formScope === "GLOBAL" ? "#f0f9ff" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#0f172a" }}>
                      <Globe size={15} color={formScope === "GLOBAL" ? "#0284c7" : "#64748b"} />
                      <span>Global Fallback</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                      All products without category override
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormScope("CATEGORY")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: formScope === "CATEGORY" ? "2px solid #0284c7" : "1px solid #cbd5e1",
                      background: formScope === "CATEGORY" ? "#f0f9ff" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#0f172a" }}>
                      <FolderTree size={15} color={formScope === "CATEGORY" ? "#0284c7" : "#64748b"} />
                      <span>Category Override</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                      Custom rate for specific category
                    </div>
                  </button>
                </div>
              </div>

              {/* Category Dropdown (if Category Scope) */}
              {formScope === "CATEGORY" && (
                <div className="form-group">
                  <label>
                    Target Marketplace Category <strong style={{ color: "#ef4444" }}>*</strong>
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    required
                    className="modal-select"
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map((cat) => (
                      <option key={cat.id || cat.categoryId} value={cat.id || cat.categoryId}>
                        {cat.name} (ID: #{cat.id || cat.categoryId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rate Input */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ margin: 0 }}>
                    Holding Fee / Commission Rate (%) <strong style={{ color: "#ef4444" }}>*</strong>
                  </label>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>Range: 0.00% to 100.00%</span>
                </div>

                <div className="input-icon-wrapper" style={{ marginTop: "6px" }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    required
                    placeholder="7.50"
                    style={{ fontSize: "1.1rem", fontWeight: 700, paddingLeft: "36px" }}
                  />
                  <Percent size={18} className="input-lead-icon" style={{ top: "14px" }} />
                </div>

                {/* Quick Presets */}
                <div className="rate-presets">
                  <span style={{ fontSize: "11px", color: "#64748b", alignSelf: "center", marginRight: "4px" }}>
                    Presets:
                  </span>
                  {PRESET_RATES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`rate-preset-btn ${parseFloat(formRate) === p ? "active" : ""}`}
                      onClick={() => setFormRate(p.toFixed(2))}
                    >
                      {p.toFixed(1)}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Effective Dates Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label>Effective From</label>
                  <input
                    type="date"
                    value={formEffectiveFrom}
                    onChange={(e) => setFormEffectiveFrom(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Effective To (Optional)</label>
                  <input
                    type="date"
                    value={formEffectiveTo}
                    onChange={(e) => setFormEffectiveTo(e.target.value)}
                    placeholder="Indefinite"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  margin: "8px 0 16px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.875rem", color: "#0f172a" }}>Rule Status</strong>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    Enable this rule immediately upon saving
                  </div>
                </div>

                <label className="rule-switch">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                  />
                  <span className="rule-slider"></span>
                </label>
              </div>

              {/* Audit Safeguard Warning in Modal */}
              {formScope === "GLOBAL" && formIsActive && (
                <div
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    color: "#92400e",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
                    <div>
                      <strong>Audit Safeguard:</strong> Saving this active global rule will automatically
                      expire and deactivate any prior active global rule in the system.
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT HISTORY DRAWER */}
      {showAuditDrawer && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "680px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ShieldCheck size={20} color="#16a34a" />
                <div>
                  <h3 style={{ margin: 0 }}>Holding Fee Audit Trail & Log</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    Complete audit history of global fallback and category-level rules
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAuditDrawer(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ maxHeight: "420px", overflowY: "auto", padding: "12px 0" }}>
              <table className="data-table" style={{ fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Scope</th>
                    <th>Rate</th>
                    <th>Active Window</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td>{r.categoryName}</td>
                      <td>
                        <strong>{r.rate.toFixed(2)}%</strong>
                      </td>
                      <td>
                        {new Date(r.effectiveFrom).toLocaleDateString()} &rarr;{" "}
                        {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : "Present"}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "10px",
                            background: r.isActive ? "#dcfce7" : "#f1f5f9",
                            color: r.isActive ? "#15803d" : "#64748b",
                          }}
                        >
                          {r.isActive ? "ACTIVE" : "EXPIRED"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowAuditDrawer(false)}
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
