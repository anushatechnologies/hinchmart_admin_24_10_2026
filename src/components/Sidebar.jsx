import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  FolderTree,
  Package,
  PackageCheck,
  ShoppingCart,
  CreditCard,
  Truck,
  BarChart3,
  Settings,
  HelpCircle,
  Store,
  Layers,
  LogOut,
  Tag,
  Ticket,
  Megaphone,
  X,
  ChevronLeft,
  Flame,
  LifeBuoy,
  MessageSquare,
  Boxes,
  RefreshCw,
  Percent,
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../firebase/AuthContext";
import logoImg from "../assets/hinchmart-logo.png";
import dataStore, { subscribeDataUpdate } from "../api/dataStore";
import { getBuyers } from "../api/buyerApi";
import { getSellers } from "../api/sellerApi";
import { getProducts, getPendingProducts, isSellerAddedProduct } from "../api/productApi";
import { getOrders } from "../api/orderApi";
import { getBanners } from "../api/bannerApi";
import { getHotDeals } from "../api/hotDealApi";
import { getAdminSellerTickets } from "../api/sellerTicketApi";
import { getAdminCustomerTickets } from "../api/customerTicketApi";
import { getTickets } from "../api/ticketApi";
import { getPendingRefunds } from "../api/refundApi";

export default function Sidebar({
  collapsed = false,
  setCollapsed = () => {},
  mobileOpen = false,
  setMobileOpen = () => {},
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [counts, setCounts] = useState(() => ({
    buyers: dataStore.getBuyers?.()?.length || 0,
    sellers: dataStore.getSellers?.()?.length || 0,
    sellerKyc: 0,
    products: dataStore.getProducts?.()?.length || 0,
    pendingProducts: 0,
    orders: dataStore.getOrders?.()?.length || 0,
    banners: 0,
    hotDeals: 0,
    sellerTickets: 0,
    customerTickets: 0,
    pendingRefunds: 0,
  }));

  useEffect(() => {
    let mounted = true;

    const refreshCounts = async () => {
      try {
        const [
          buyersData,
          sellersData,
          productsData,
          pendingProductsData,
          ordersData,
          bannersData,
          hotDealsData,
          sellerTicketsData,
          customerTicketsData,
          refundsData,
        ] = await Promise.allSettled([
          getBuyers(),
          getSellers(),
          getProducts({ limit: 20, page: 1 }),
          getPendingProducts(),
          getOrders({ limit: 20, page: 1 }),
          getBanners(),
          getHotDeals(),
          getAdminSellerTickets({ status: "OPEN", limit: 5 }),
          getAdminCustomerTickets({ status: "OPEN", limit: 5 }),
          getPendingRefunds(),
        ]);

        if (!mounted) return;

        const buyersCount =
          buyersData.status === "fulfilled" && Array.isArray(buyersData.value)
            ? buyersData.value.length
            : dataStore.getBuyers().length;

        const sellersList =
          sellersData.status === "fulfilled" && Array.isArray(sellersData.value)
            ? sellersData.value
            : dataStore.getSellers();
        const sellersCount = sellersList.length;
        const pendingSellersCount = sellersList.filter(
          (s) => (s.approvalStatus || s.status || "").toUpperCase() === "PENDING"
        ).length;

        const productsCount =
          productsData.status === "fulfilled" && Array.isArray(productsData.value)
            ? productsData.value.length
            : dataStore.getProducts().length;

        const ordersCount =
          ordersData.status === "fulfilled" && Array.isArray(ordersData.value)
            ? ordersData.value.length
            : dataStore.getOrders().length;

        const bannersCount =
          bannersData.status === "fulfilled" && Array.isArray(bannersData.value)
            ? bannersData.value.length
            : 0;

        const hotDealsCount =
          hotDealsData.status === "fulfilled" && Array.isArray(hotDealsData.value)
            ? hotDealsData.value.length
            : 0;

        const pendingProductsCount =
          pendingProductsData.status === "fulfilled" && Array.isArray(pendingProductsData.value)
            ? pendingProductsData.value.filter(isSellerAddedProduct).length
            : 0;

        const openSellerTicketsCount =
          sellerTicketsData.status === "fulfilled" && sellerTicketsData.value?.data
            ? sellerTicketsData.value.pagination?.total ?? sellerTicketsData.value.data.length
            : 0;

        const openCustomerTicketsCount =
          customerTicketsData.status === "fulfilled" && customerTicketsData.value?.data
            ? customerTicketsData.value.pagination?.total ?? customerTicketsData.value.data.length
            : 0;

        const pendingRefundsCount =
          refundsData.status === "fulfilled" && Array.isArray(refundsData.value)
            ? refundsData.value.filter((r) => r.status !== "REFUNDED").length
            : 0;

        setCounts({
          buyers: buyersCount,
          sellers: sellersCount,
          sellerKyc: pendingSellersCount,
          products: productsCount,
          pendingProducts: pendingProductsCount,
          orders: ordersCount,
          banners: bannersCount,
          hotDeals: hotDealsCount,
          sellerTickets: openSellerTicketsCount,
          customerTickets: openCustomerTicketsCount,
          pendingRefunds: pendingRefundsCount,
        });
      } catch {
        if (!mounted) return;
        setCounts((prev) => ({
          ...prev,
          buyers: dataStore.getBuyers?.()?.length || 0,
          sellers: dataStore.getSellers?.()?.length || 0,
          products: dataStore.getProducts?.()?.length || 0,
          orders: dataStore.getOrders?.()?.length || 0,
        }));
      }
    };

    refreshCounts();
    const unsubscribe = subscribeDataUpdate(() => {
      refreshCounts();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const navSections = useMemo(
    () => [
      {
        title: "CORE OVERSIGHT",
        items: [
          { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
          { name: "Buyers", path: "/admin/buyers", icon: Users, badge: counts.buyers, badgeType: "blue" },
          { name: "Sellers", path: "/admin/sellers", icon: Building2, badge: counts.sellers, badgeType: "blue" },
          { name: "Marketplace Stores", path: "/admin/stores", icon: Store },
          {
            name: "Seller KYC",
            path: "/admin/seller-approvals",
            icon: UserCheck,
            badge: counts.sellerKyc > 0 ? counts.sellerKyc : null,
            badgeType: "orange",
          },
        ],
      },
      {
        title: "SUPPORT & TICKETS",
        items: [
          {
            name: "Support Tickets",
            path: "/admin/tickets",
            icon: LifeBuoy,
            badge: counts.customerTickets > 0 ? counts.customerTickets : null,
            badgeType: "blue",
          },
          {
            name: "Seller Tickets",
            path: "/admin/seller-tickets",
            icon: Building2,
            badge: counts.sellerTickets > 0 ? counts.sellerTickets : null,
            badgeType: "orange",
          },
        ],
      },
      {
        title: "CATALOG & PRODUCTS",
        items: [
          { name: "Categories", path: "/admin/categories", icon: FolderTree },
          { name: "Subcategories", path: "/admin/subcategories", icon: Layers },
          { name: "Brands", path: "/admin/brands", icon: Tag },
          { name: "Products", path: "/admin/products", icon: Package, badge: counts.products, badgeType: "blue" },
          { name: "Vendor Stock", path: "/admin/vendor-stock", icon: Boxes },
          {
            name: "Product Approvals",
            path: "/admin/product-approvals",
            icon: PackageCheck,
            badge: counts.pendingProducts > 0 ? counts.pendingProducts : null,
            badgeType: "orange",
          },
          { name: "RFQs", path: "/admin/rfqs", icon: HelpCircle },
        ],
      },
      {
        title: "MARKETING & MERCHANDISING",
        items: [
          { name: "Hot Deals", path: "/admin/hot-deals", icon: Flame, badge: counts.hotDeals, badgeType: "orange" },
          { name: "Banners", path: "/admin/banners", icon: Megaphone, badge: counts.banners, badgeType: "blue" },
          { name: "Platform Coupons", path: "/admin/coupons", icon: Ticket },
        ],
      },
      {
        title: "COMMERCE & LOGISTICS",
        items: [
          { name: "Orders", path: "/admin/orders", icon: ShoppingCart, badge: counts.orders, badgeType: "blue" },
          { name: "Payments & Invoices", path: "/admin/payments", icon: CreditCard },
          {
            name: "Holding & Commission",
            path: "/admin/commission-rules",
            icon: Percent,
          },
          {
            name: "Pending Refunds",
            path: "/admin/refunds",
            icon: RefreshCw,
            badge: counts.pendingRefunds > 0 ? counts.pendingRefunds : null,
            badgeType: "orange",
          },
          { name: "Shipments & Logistics", path: "/admin/shipments", icon: Truck },
          { name: "Reports & Analytics", path: "/admin/reports", icon: BarChart3 },
          { name: "Settings", path: "/admin/settings", icon: Settings },
        ],
      },
    ],
    [counts]
  );

  const handleNavClick = () => {
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (logout) {
        await logout();
      }
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
      navigate("/login");
    }
  };

  const isItemActive = (path) => {
    if (path === "/admin/dashboard") {
      return (
        location.pathname === "/admin/dashboard" ||
        location.pathname === "/admin" ||
        location.pathname === "/admin/"
      );
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <>
      {/* Backdrop overlay for mobile drawer */}
      <div
        className={`sidebar-backdrop ${mobileOpen ? "active" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Brand Header with Clean Cropped Logo */}
        <div
          className="sidebar-header"
          onClick={() => {
            navigate("/admin/dashboard");
            handleNavClick();
          }}
          title="HinchMart Admin Web Hub"
        >
          <img
            src={logoImg}
            alt="HinchMart Logo"
            className="sidebar-logo"
          />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">HINCHMART</span>
            <span className="sidebar-portal-tag portal-tag-admin">Admin Web Hub</span>
          </div>

          {/* Close button inside sidebar on mobile */}
          <button
            type="button"
            className="sidebar-mobile-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMobileOpen(false);
            }}
            title="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="sidebar-nav">
          {navSections.map((section, idx) => (
            <div key={idx} className="sidebar-section-wrap">
              <div className="sidebar-section-title">{section.title}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.path);

                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={`sidebar-link ${active ? "active" : ""}`}
                    onClick={handleNavClick}
                    title={item.name}
                  >
                    <div className="sidebar-link-content">
                      <Icon size={17} color={active ? "#FF6500" : "#94A3B8"} />
                      <span className="sidebar-link-label">{item.name}</span>
                    </div>

                    {item.badge !== undefined && item.badge !== null && (
                      <span
                        className={`sidebar-badge ${
                          item.badgeType === "orange"
                            ? "sidebar-badge-orange"
                            : item.badgeType === "red"
                            ? "sidebar-badge-red"
                            : "sidebar-badge-blue"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Profile Info & Logout */}
        <div className="sidebar-footer">
          <div className="user-profile-widget">
            <div className="user-profile-left">
              <div className="user-avatar">AD</div>
              <div className="user-info">
                <div className="user-name">HinchMart SuperAdmin</div>
                <div className="user-role">{user?.email || "admin@hinchmart.com"}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="sidebar-logout-btn"
              title="Logout of HinchMart (Go to Login/Signup)"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
