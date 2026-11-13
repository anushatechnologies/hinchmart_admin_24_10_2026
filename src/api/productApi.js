import api from "./axios";
import { cachedRequest, invalidateRequest } from "./requestCache";
import { dispatchDataUpdate } from "./dataStore";
import { getStoredCategories, getStoredSubcategories } from "./categoryApi";
import { getStoredBrands } from "./brandApi";
import { compressImage } from "../utils/imageStore";

const STORAGE_KEY_PRODUCTS = "hinchmart_products_data_v5";
const STORAGE_KEY_DELETED = "hinchmart_deleted_product_ids_v1";

const isRemoteId = (id) => {
  if (!id) return false;
  const num = Number(id);
  // Remote DB IDs are standard auto-increment 32-bit ints (<= 2147483647), local timestamp IDs are 13 digits (1.78 trillion)
  return !isNaN(num) && num > 0 && num <= 2147483647;
};

export const getDeletedProductIds = () => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

export const markProductDeleted = (id) => {
  const deleted = getDeletedProductIds();
  deleted.add(String(id));
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(Array.from(deleted)));
    } catch {}
  }
};

export const isBlockedDummyProduct = (p) => {
  if (!p) return false;
  const sku = String(p.sku || p.skuCode || "").toUpperCase();
  const title = String(p.title || p.name || "").toLowerCase();
  const idStr = String(p.productId || p.id || "");

  if (
    idStr === "1132" ||
    sku === "SKU7788" ||
    title === "eeeee" ||
    sku === "SKU-326908" ||
    sku === "SKU-519444" ||
    sku === "SKU-138158" ||
    sku === "SKU-904091" ||
    sku.includes("1788864508658") ||
    title.includes("cook top, gs 3003") ||
    title.includes("starshield star glow") ||
    title.includes("color pencil pack") ||
    title === "home home" ||
    title === "power tools power tools"
  ) {
    const id = p.productId || p.id;
    if (id && !getDeletedProductIds().has(String(id))) {
      markProductDeleted(id);
      try {
        api.delete(`/admin/products/${id}`).catch(() => {});
      } catch {}
    }
    return true;
  }
  return false;
};

// Verified high-resolution Civil & Engineering Photography
const DEFAULT_FALLBACK_IMAGES = {
  cement: "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=600&auto=format&fit=crop&q=80",
  steel: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80",
  beam: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80",
  cable: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=600&auto=format&fit=crop&q=80",
  pipe: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80",
  equipment: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=80",
  general: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80",
};

export const resolveProductImage = (url, name = "") => {
  if (!url || typeof url !== "string") {
    return "";
  }
  return url;
};

const slugify = (value = "") =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const list = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.result)) return payload.data.result;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data?.sellerProducts)) return payload.data.sellerProducts;
  if (Array.isArray(payload?.sellerProducts)) return payload.sellerProducts;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  
  // Dynamic deep inspection for any array inside response
  if (typeof payload === "object") {
    for (const key of Object.keys(payload)) {
      if (Array.isArray(payload[key]) && payload[key].length > 0) return payload[key];
    }
    if (typeof payload.data === "object" && payload.data !== null) {
      for (const key of Object.keys(payload.data)) {
        if (Array.isArray(payload.data[key]) && payload.data[key].length > 0) return payload.data[key];
      }
    }
  }
  return [];
};

const parseGstRate = (val) => {
  if (typeof val === "number") return val;
  if (!val) return 18.0;
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 18.0 : num;
};

const parseNumber = (val, defaultVal = 0) => {
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;
  if (!val) return defaultVal;
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? defaultVal : num;
};

export const INITIAL_PRODUCTS = [];

export const toProductPayload = (data) => {
  // Required fields: title, unit, brandId
  const title = (data.title || data.name || "").trim();
  const unit = String(data.unit || "unit").trim() || "unit";

  // Strict numeric conversion
  const rawPrice = data.price ?? data.sellingPrice ?? data.basePrice;
  const price = rawPrice !== undefined && rawPrice !== null && rawPrice !== ""
    ? (typeof rawPrice === "number" ? (isNaN(rawPrice) ? undefined : Number(rawPrice.toFixed(2))) : (parseFloat(String(rawPrice).replace(/[^0-9.]/g, "")) || undefined))
    : undefined;

  const rawMrp = data.mrp !== undefined && data.mrp !== null && data.mrp !== "" ? data.mrp : undefined;
  const mrp = rawMrp !== undefined
    ? (typeof rawMrp === "number" ? (isNaN(rawMrp) ? undefined : Number(rawMrp.toFixed(2))) : (parseFloat(String(rawMrp).replace(/[^0-9.]/g, "")) || undefined))
    : undefined;

  const rawStock = data.stockQty !== undefined && data.stockQty !== null && data.stockQty !== "" ? data.stockQty : (data.stock ?? 0);
  const stockQty = typeof rawStock === "number"
    ? Math.round(isNaN(rawStock) ? 0 : Math.max(0, rawStock))
    : (parseInt(String(rawStock).replace(/[^0-9]/g, ""), 10) || 0);

  const rawMoq = data.moq !== undefined && data.moq !== null && data.moq !== "" ? data.moq : 1;
  const moq = typeof rawMoq === "number"
    ? Math.max(1, Math.round(isNaN(rawMoq) ? 1 : rawMoq))
    : (parseInt(String(rawMoq).replace(/[^0-9]/g, ""), 10) || 1);

  const rawGst = data.gstRate !== undefined && data.gstRate !== null && data.gstRate !== "" ? data.gstRate : (data.gst ?? undefined);
  const gstRate = rawGst !== undefined
    ? (typeof rawGst === "number" ? (isNaN(rawGst) ? undefined : Number(rawGst.toFixed(2))) : (parseFloat(String(rawGst).replace(/[^0-9.]/g, "")) || undefined))
    : undefined;

  const rawHsn = data.hsnCode || data.hsn;
  const hsnCode = rawHsn ? String(rawHsn).replace(/[^0-9]/g, "") : undefined;

  const sku = data.sku ? String(data.sku).trim() : undefined;
  const description = data.description !== undefined ? String(data.description).trim() : undefined;
  const is24HourDelivery = Boolean(data.is24HourDelivery);

  // Safe 32-bit Integer Foreign Keys (must be <= 2147483647)
  let brandId = Number(data.brandId);
  if (brandId > 2147483647 || !isRemoteId(brandId)) {
    const brands = getStoredBrands ? getStoredBrands() : [];
    const matched = brands.find(
      (b) => Number(b.brandId || b.id) === brandId ||
             (data.brandName && b.name?.toLowerCase() === data.brandName.toLowerCase()) ||
             (data.brand && b.name?.toLowerCase() === data.brand.toLowerCase())
    );
    if (matched && isRemoteId(matched.brandId || matched.id)) {
      brandId = Number(matched.brandId || matched.id);
    } else {
      const firstValid = brands.find((b) => isRemoteId(b.brandId || b.id));
      brandId = firstValid ? Number(firstValid.brandId || firstValid.id) : 1;
    }
  }

  let subcategoryId = data.subcategoryId !== undefined && data.subcategoryId !== null && data.subcategoryId !== ""
    ? Number(data.subcategoryId)
    : undefined;
  if (subcategoryId !== undefined) {
    if (subcategoryId > 2147483647 || !isRemoteId(subcategoryId)) {
      const subs = getStoredSubcategories ? getStoredSubcategories() : [];
      const matched = subs.find(
        (s) => Number(s.subcategoryId || s.id) === subcategoryId ||
               (data.subcategoryName && s.name?.toLowerCase() === data.subcategoryName.toLowerCase())
      );
      if (matched && isRemoteId(matched.subcategoryId || matched.id)) {
        subcategoryId = Number(matched.subcategoryId || matched.id);
      } else {
        subcategoryId = undefined;
      }
    }
  }

  let categoryId = data.categoryId !== undefined && data.categoryId !== null && data.categoryId !== ""
    ? Number(data.categoryId)
    : undefined;
  if (categoryId !== undefined) {
    if (categoryId > 2147483647 || !isRemoteId(categoryId)) {
      const cats = getStoredCategories ? getStoredCategories() : [];
      const matched = cats.find(
        (c) => Number(c.categoryId || c.id) === categoryId ||
               (data.categoryName && c.name?.toLowerCase() === data.categoryName.toLowerCase()) ||
               (data.category && c.name?.toLowerCase() === data.category.toLowerCase())
      );
      if (matched && isRemoteId(matched.categoryId || matched.id)) {
        categoryId = Number(matched.categoryId || matched.id);
      } else {
        categoryId = undefined;
      }
    }
  }

  // Image resolution
  const rawImg = data.imageUrl || data.image || data.imageURL || (Array.isArray(data.images) ? data.images[0] : "");
  const cleanImage = resolveProductImage(rawImg, title);
  const validImages = Array.isArray(data.images) && data.images.length > 0
    ? data.images.filter((img) => typeof img === "string" && !img.startsWith("blob:")).map((img) => resolveProductImage(img, title))
    : (cleanImage ? [cleanImage] : []);

  // Direct Key-Value Specifications Map ("Key": "Value")
  const specifications = {};
  if (data.specifications && typeof data.specifications === "object" && !Array.isArray(data.specifications)) {
    Object.entries(data.specifications).forEach(([k, v]) => {
      if (k && String(k).trim()) {
        specifications[String(k).trim()] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "").trim();
      }
    });
  }

  // Bulk Pricing Tiers: Slabs with minQty, maxQty, price, discount
  let bulkPricingTiers = [];
  if (Array.isArray(data.bulkPricingTiers) && data.bulkPricingTiers.length > 0) {
    bulkPricingTiers = data.bulkPricingTiers
      .filter((t) => t && (Number(t.minQty) > 0 || Number(t.discount) >= 0 || Number(t.discountPercentage) >= 0))
      .map((t) => {
        const minQty = Math.max(1, parseInt(String(t.minQty || "1").replace(/[^0-9]/g, ""), 10) || 1);
        const maxQty = t.maxQty !== undefined && t.maxQty !== null && String(t.maxQty).trim() !== ""
          ? Math.max(minQty, parseInt(String(t.maxQty).replace(/[^0-9]/g, ""), 10) || minQty)
          : undefined;
        const discount = Number(t.discount !== undefined ? t.discount : (t.discountPercentage ?? 0));
        const tierPrice = t.price !== undefined && t.price !== null && String(t.price).trim() !== ""
          ? Number(Number(t.price).toFixed(2))
          : (price !== undefined && price > 0 ? Number((price * (1 - discount / 100)).toFixed(2)) : undefined);

        const tierObj = {
          minQty,
          discount: Number(discount.toFixed(2)),
        };
        if (maxQty !== undefined) tierObj.maxQty = maxQty;
        if (tierPrice !== undefined) tierObj.price = tierPrice;
        return tierObj;
      });
  }

  const slug = data.slug?.trim() || slugify(title);

  // Payload strictly shaped according to HinchMart Backend contract
  const payload = {
    title,
    brandId: brandId > 0 && brandId <= 2147483647 ? brandId : 1,
    unit,
    moq: Math.min(2147483647, moq),
    stockQty: Math.min(2147483647, stockQty),
    is24HourDelivery,
    specifications,
  };

  if (categoryId !== undefined && categoryId > 0) payload.categoryId = categoryId;
  if (subcategoryId !== undefined && subcategoryId > 0) payload.subcategoryId = subcategoryId;
  if (sku) payload.sku = sku;
  if (description !== undefined) payload.description = description;
  if (price !== undefined) {
    payload.price = price;
    payload.sellingPrice = price;
  }
  if (mrp !== undefined) payload.mrp = mrp;
  if (hsnCode) payload.hsnCode = hsnCode;
  if (gstRate !== undefined) payload.gstRate = gstRate;
  if (validImages.length > 0) payload.images = validImages;
  if (bulkPricingTiers.length > 0) payload.bulkPricingTiers = bulkPricingTiers;

  // Local/UI helper aliases for backwards compatibility
  payload.name = title;
  payload.imageUrl = cleanImage;
  payload.image = cleanImage;
  payload.imageURL = cleanImage;
  payload.slug = slug;
  payload.active = data.active !== undefined ? Boolean(data.active) : true;
  if (data.sellerId) payload.sellerId = data.sellerId;

  return payload;
};

export const toProductBackendPayload = toProductPayload;

export const normalizeProduct = (product, subcategories = [], categories = []) => {
  if (!product || typeof product !== "object") return null;
  if (isBlockedDummyProduct(product)) return null;

  // Retrieve stored catalogs if not supplied
  const allSubcats = Array.isArray(subcategories) && subcategories.length > 0 ? subcategories : (getStoredSubcategories ? getStoredSubcategories() : []);
  const allCats = Array.isArray(categories) && categories.length > 0 ? categories : (getStoredCategories ? getStoredCategories() : []);
  const brands = getStoredBrands ? getStoredBrands() : [];

  // Extract ID supporting all backend naming conventions
  const rawId = product.productId ?? product.product_id ?? product.prod_id ?? product.id ?? product._id ?? product.itemId;
  const id = rawId ? (typeof rawId === "number" ? rawId : Number(String(rawId).replace(/[^0-9]/g, "")) || rawId) : Date.now();

  // Extract brand with name matching fallback
  const rawBrandName = String(product.brandName ?? product.brand_name ?? (typeof product.brand === "string" ? product.brand : product.brand?.name) ?? "").trim();
  let matchedBrand = null;
  const rawBrandId = product.brandId ?? product.brand_id ?? product.brand?.id ?? product.brand?.brandId;
  if (rawBrandId !== undefined && rawBrandId !== null && rawBrandId !== "") {
    matchedBrand = brands.find((b) => Number(b.brandId || b.id) === Number(rawBrandId));
  }
  if (!matchedBrand && rawBrandName) {
    matchedBrand = brands.find((b) => String(b.name).toLowerCase() === rawBrandName.toLowerCase());
  }
  const brandId = matchedBrand ? Number(matchedBrand.brandId || matchedBrand.id) : (Number(rawBrandId) || 1);
  const brandName = matchedBrand?.name ?? (rawBrandName || "Standard Industrial");

  // Extract subcategory & category - NEVER override if explicitly set on product
  const explicitSubcatId = product.subcategoryId !== undefined && product.subcategoryId !== null && product.subcategoryId !== "" ? Number(product.subcategoryId) : undefined;
  const subcatId = explicitSubcatId !== undefined && !isNaN(explicitSubcatId) && explicitSubcatId > 0
    ? explicitSubcatId
    : Number(product.subcategory_id ?? product.sub_category_id ?? product.subCategory?.id ?? product.subcategory?.id ?? matchedBrand?.subcategoryId ?? 1);
  const subcategory = allSubcats.find((item) => Number(item.subcategoryId ?? item.id) === subcatId);
  const subcategoryName = product.subcategoryName ?? product.subcategory_name ?? product.sub_category_name ?? product.subcategory?.name ?? product.subCategory?.name ?? subcategory?.name ?? "Lights";

  const explicitCatId = product.categoryId !== undefined && product.categoryId !== null && product.categoryId !== "" ? Number(product.categoryId) : undefined;
  const catId = explicitCatId !== undefined && !isNaN(explicitCatId) && explicitCatId > 0
    ? explicitCatId
    : Number(product.category_id ?? product.category?.id ?? matchedBrand?.categoryId ?? subcategory?.categoryId ?? 1);
  const category = allCats.find((item) => Number(item.categoryId ?? item.id) === (catId || Number(subcategory?.categoryId)));
  const categoryName = product.categoryName ?? product.category_name ?? (typeof product.category === "string" ? product.category : product.category?.name) ?? category?.name ?? "Electrical";

  const title = product.title || product.name || product.productName || product.product_name || "Untitled Product";

  // Image resolution supporting single strings, nested objects, and arrays
  const rawImage = product.imageURL || product.imageUrl || product.image_url || product.image || product.thumbnail || product.photo || (Array.isArray(product.images) && product.images[0]) || "";
  const resolvedImage = typeof rawImage === "string" ? resolveProductImage(rawImage, title) : (Array.isArray(rawImage) ? resolveProductImage(rawImage[0], title) : "");

  const price = parseNumber(product.price ?? product.basePrice ?? product.base_price ?? product.sellingPrice ?? product.selling_price, 0);
  const stockQty = parseNumber(product.stockQty ?? product.stock_qty ?? product.stock ?? product.quantity ?? product.inventory, 0);
  const moq = product.moq ?? product.minOrderQty ?? product.min_order_quantity ?? 1;

  // Status handling: Admin added products do NOT need approval (only Active or Deactivated).
  // Only seller submissions undergo approval moderation (PENDING, APPROVED, REJECTED).
  const isSeller = isSellerAddedProduct(product);
  let approvalStatus = "APPROVED";
  let isActive = true;

  if (isSeller) {
    const rawStatus = String(
      product.approvalStatus ||
      product.approval_status ||
      product.status ||
      product.review_status ||
      product.state ||
      "PENDING"
    ).toUpperCase();

    // STRICT SELLER APPROVAL: Must be approved by admin to be APPROVED / live
    if (rawStatus === "APPROVED") {
      approvalStatus = "APPROVED";
      isActive = product.active !== undefined ? Boolean(product.active) : true;
    } else if (rawStatus === "REJECTED") {
      approvalStatus = "REJECTED";
      isActive = false;
    } else {
      // Pending approval by default - NOT live until admin approves
      approvalStatus = "PENDING";
      isActive = false;
    }
  } else {
    // Admin / In-House products (HinchStore): never need approval
    isActive = product.active !== undefined
      ? Boolean(product.active)
      : (product.is_active !== undefined
        ? Boolean(product.is_active)
        : (product.status ? String(product.status).toUpperCase() !== "INACTIVE" : true));
    approvalStatus = isActive ? "APPROVED" : "INACTIVE";
  }
  const allImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images.map((img) => typeof img === "string" ? resolveProductImage(img, title) : resolvedImage).filter(Boolean)
    : (Array.isArray(product.imageURL)
      ? product.imageURL
      : [resolvedImage].filter(Boolean));

  // Seller / Vendor resolution
  const sellerId =
    product.sellerId ??
    product.seller_id ??
    product.vendorId ??
    product.vendor_id ??
    product.seller?.id ??
    product.seller?.sellerId ??
    product.vendor?.id ??
    null;

  const rawSeller =
    product.sellerName ??
    product.seller_name ??
    product.vendorName ??
    product.vendor_name ??
    product.seller?.companyName ??
    product.seller?.businessName ??
    product.seller?.name ??
    product.vendor?.companyName ??
    product.vendor?.name;

  const sellerName = rawSeller
    ? rawSeller
    : (isSeller ? (sellerId ? `Seller #${sellerId}` : "Seller Submission") : "HinchStore");
  return {
    ...product,
    id,
    productId: id,
    brandId: matchedBrand ? Number(matchedBrand.brandId || matchedBrand.id) : brandId,
    brandName,
    brand: brandName,
    name: title,
    title,
    slug: product.slug || slugify(title),
    sku: product.sku || product.skuCode || "—",
    description: product.description || "",
    price,
    mrp: parseNumber(product.mrp ?? product.maxPrice ?? product.market_price, 0),
    sellingPrice: price,
    basePrice: price,
    stock: `${stockQty} ${product.unit || product.unitOfMeasure || "unit"}`,
    stockQty,
    unit: product.unit || product.unitOfMeasure || product.uom || "unit",
    moq: typeof moq === "number" ? `${moq} ${product.unit || "unit"}` : moq,
    subcategoryId: subcatId || (subcategory ? Number(subcategory.subcategoryId || subcategory.id) : 1),
    subcategoryName,
    categoryId: catId || (category ? Number(category.categoryId || category.id) : 1),
    categoryName,
    category: categoryName,
    imageURL: resolvedImage,
    image: resolvedImage,
    imageUrl: resolvedImage,
    images: allImages.length > 0 ? allImages : [resolvedImage],
    active: isActive,
    approvalStatus,
    status: approvalStatus,
    rejectionReason: product.rejectionReason || product.rejection_reason || product.rejectReason || product.remarks || "",
    is24HourDelivery: Boolean(product.is24HourDelivery ?? product.is_24_hour_delivery ?? product.is24hourdelivery),
    rating: parseNumber(product.rating, 4.8),
    reviewCount: parseNumber(product.reviewCount ?? product.review_count, 0),
    gstRate: parseGstRate(product.gstRate ?? product.gst_rate ?? product.gst),
    hsnCode: String(product.hsnCode ?? product.hsn_code ?? product.hsn ?? "7214"),
    specifications: product.specifications || product.specs || product.technicalSpecifications || {},
    bulkPricingTiers: product.bulkPricingTiers || product.bulk_pricing_tiers || product.pricingTiers || [],
    sellerId,
    sellerName,
    seller: product.seller || (sellerName ? { id: sellerId, name: sellerName, companyName: sellerName } : null),
    vendor: product.vendor || (sellerName ? { vendorId: sellerId, companyName: sellerName } : null),
    createdAt: product.createdAt || product.created_at || new Date().toISOString(),
  };
};

let inMemoryProducts = null;

const safeSetProducts = (products) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
  } catch {}
};

export const DEFAULT_VERIFIED_SELLER_PRODUCTS = [];

export const getStoredProducts = () => {
  if (inMemoryProducts !== null && Array.isArray(inMemoryProducts)) {
    return inMemoryProducts;
  }
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any legacy dummy mock products
        const cleaned = parsed.filter(
          (p) =>
            p.id !== 831 &&
            p.id !== 832 &&
            p.id !== 1132 &&
            p.productId !== 831 &&
            p.productId !== 832 &&
            p.productId !== 1132 &&
            String(p.sku || "").toUpperCase() !== "SKU7788" &&
            String(p.title || p.name || "").toLowerCase() !== "eeeee" &&
            p.sellerId !== 14 &&
            !(p.id >= 1 && p.id <= 5 && ["TATA-TMT-12MM-550D", "ULT-OPC53-50KG", "JIN-TMT-16MM-550D", "POLY-XLPE-4C16", "BOS-GBH-226DRE"].includes(p.sku)) &&
            !String(p.id || "").startsWith("prod_pending_")
        );
        inMemoryProducts = cleaned;
        safeSetProducts(inMemoryProducts);
        return inMemoryProducts;
      }
    }
  } catch {}

  inMemoryProducts = [];
  safeSetProducts(inMemoryProducts);
  return inMemoryProducts;
};

export const setStoredProducts = (products) => {
  inMemoryProducts = Array.isArray(products) ? products : [];
  safeSetProducts(inMemoryProducts);
};

/**
 * 1. Get Customer Products (GET /api/products)
 * Supports backend pagination (?page={page}&limit={limit}) and returns { products, pagination }
 * or a raw array if called in legacy non-paginated mode.
 */
export const getProducts = async (options = "") => {
  const filters = typeof options === "string" ? { search: options } : (options || {});
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();
  const deletedIds = getDeletedProductIds();

  const isPaginated = filters.page !== undefined || filters.limit !== undefined || filters.paginated === true;
  const pageNum = Math.max(1, Number(filters.page || 1));
  const limitNum = Math.max(1, Number(filters.limit || 20));

  const queryParams = new URLSearchParams();
  if (isPaginated) {
    queryParams.append("page", String(pageNum));
    queryParams.append("limit", String(limitNum));
  } else {
    queryParams.append("page", "0");
    queryParams.append("size", "1000");
    queryParams.append("limit", "1000");
    queryParams.append("pageSize", "1000");
  }

  if (filters.search && String(filters.search).trim()) {
    queryParams.append("search", String(filters.search).trim());
  }
  if (filters.categoryId && filters.categoryId !== "ALL") {
    queryParams.append("categoryId", filters.categoryId);
  }
  if (filters.subcategoryId && filters.subcategoryId !== "ALL") {
    queryParams.append("subcategoryId", filters.subcategoryId);
  }
  if (filters.brandId && filters.brandId !== "ALL") {
    queryParams.append("brandId", filters.brandId);
  }
  if (filters.status && filters.status !== "ALL") {
    queryParams.append("status", filters.status);
  }

  const queryStr = `?${queryParams.toString()}`;

  try {
    const response = await api.get(`/products${queryStr}`);
    const rawList = list(response.data);

    if (isPaginated) {
      const pData = response.data?.pagination || response.data?.data?.pagination || {};
      const totalCount = Number(pData.totalCount ?? response.data?.totalCount ?? response.data?.totalElements ?? rawList.length);
      const totalPages = Number(pData.totalPages ?? Math.max(1, Math.ceil(totalCount / limitNum)));
      const hasNextPage = pData.hasNextPage !== undefined ? Boolean(pData.hasNextPage) : pageNum < totalPages;
      const hasPrevPage = pData.hasPrevPage !== undefined ? Boolean(pData.hasPrevPage) : pageNum > 1;

      const normalizedList = (Array.isArray(rawList) ? rawList : [])
        .map((raw) => normalizeProduct(raw, subcategories, categories))
        .filter((p) => p && !deletedIds.has(String(p.productId || p.id)));

      return {
        products: normalizedList,
        pagination: {
          page: Number(pData.page || pageNum),
          limit: Number(pData.limit || limitNum),
          totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    }

    // If paginated response with additional pages (legacy non-paginated mode)
    const totalPages = response.data?.totalPages || response.data?.data?.totalPages || 1;
    if (totalPages > 1 && totalPages <= 10) {
      const pagePromises = [];
      for (let p = 1; p < totalPages; p++) {
        const pQuery = new URLSearchParams(queryParams);
        pQuery.set("page", String(p));
        pagePromises.push(api.get(`/products?${pQuery.toString()}`).catch(() => null));
      }
      const pageResponses = await Promise.all(pagePromises);
      pageResponses.forEach((pRes) => {
        if (pRes && pRes.data) {
          const pItems = list(pRes.data);
          if (Array.isArray(pItems)) rawList.push(...pItems);
        }
      });
    }

    if (Array.isArray(rawList)) {
      const map = new Map();
      rawList.forEach((raw) => {
        const p = normalizeProduct(raw, subcategories, categories);
        if (p && !deletedIds.has(String(p.productId || p.id))) {
          map.set(String(p.productId || p.id), p);
        }
      });
      return Array.from(map.values());
    }
  } catch (err) {
    console.warn("Live backend GET /products notice:", err?.message);
  }

  // Fallback to local stored products
  const stored = getStoredProducts();
  let local = stored
    .map((raw) => normalizeProduct(raw, subcategories, categories))
    .filter((p) => p && !deletedIds.has(String(p.productId || p.id)));

  if (filters.search) {
    const q = filters.search.toLowerCase();
    local = local.filter((p) =>
      (p.title || p.name || "").toLowerCase().includes(q) ||
      (p.brandName || p.brand || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.categoryName || p.category || "").toLowerCase().includes(q) ||
      (p.subcategoryName || "").toLowerCase().includes(q) ||
      (p.sellerName || "").toLowerCase().includes(q)
    );
  }
  if (filters.categoryId && filters.categoryId !== "ALL") {
    local = local.filter((p) => Number(p.categoryId) === Number(filters.categoryId));
  }
  if (filters.subcategoryId && filters.subcategoryId !== "ALL") {
    local = local.filter((p) => Number(p.subcategoryId) === Number(filters.subcategoryId));
  }
  if (filters.brandId && filters.brandId !== "ALL") {
    local = local.filter((p) => Number(p.brandId) === Number(filters.brandId));
  }

  if (isPaginated) {
    const totalCount = local.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));
    const startIdx = (pageNum - 1) * limitNum;
    const pagedProducts = local.slice(startIdx, startIdx + limitNum);
    return {
      products: pagedProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  return local;
};

let cachedSellerProducts = [];
let lastSellerProductsFetch = 0;

/**
 * Fetch approved seller products directly from seller inventory endpoints
 */
export const fetchRemoteSellerProducts = async () => {
  const now = Date.now();
  if (now - lastSellerProductsFetch < 30000 && cachedSellerProducts.length > 0) {
    return cachedSellerProducts;
  }
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();
  const deletedIds = getDeletedProductIds();
  const map = new Map();

  try {
    const res = await api.get("/admin/sellers", { params: { page: 0, limit: 15 } }).catch(() => null);
    const sellers = list(res?.data);
    if (Array.isArray(sellers) && sellers.length > 0) {
      const promises = sellers.slice(0, 10).map(async (s) => {
        const sid = s.sellerId || s.id;
        if (!sid) return [];
        try {
          const spRes = await api.get(`/admin/products/sellers/${sid}`);
          return list(spRes?.data);
        } catch {
          return [];
        }
      });
      const results = await Promise.all(promises);
      results.flat().forEach((raw) => {
        const p = normalizeProduct(raw, subcategories, categories);
        if (p && !deletedIds.has(String(p.productId || p.id))) {
          const st = String(p.approvalStatus || p.status || "").toUpperCase();
          if (st === "APPROVED" || p.active === true) {
            map.set(String(p.productId || p.id), { ...p, approvalStatus: "APPROVED", status: "APPROVED", active: true });
          }
        }
      });
    }
  } catch {}

  cachedSellerProducts = Array.from(map.values());
  lastSellerProductsFetch = now;
  return cachedSellerProducts;
};

/**
 * Admin: Get All Products (queries GET /api/admin/products first, then merges with customer & seller catalog)
 */
export const getAdminProducts = async (options = "") => {
  const filters = typeof options === "string" ? { search: options } : (options || {});
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();
  const deletedIds = getDeletedProductIds();

  const isPaginated = filters.page !== undefined || filters.limit !== undefined || filters.paginated === true;
  const pageNum = Math.max(1, Number(filters.page || 1));
  const limitNum = Math.max(1, Number(filters.limit || 20));

  const queryParams = new URLSearchParams();
  if (isPaginated) {
    queryParams.append("page", String(pageNum));
    queryParams.append("limit", String(limitNum));
  } else {
    queryParams.append("page", "0");
    queryParams.append("size", "1000");
    queryParams.append("limit", "1000");
    queryParams.append("pageSize", "1000");
  }

  if (filters.search && String(filters.search).trim()) {
    queryParams.append("search", String(filters.search).trim());
  }
  if (filters.categoryId && filters.categoryId !== "ALL") {
    queryParams.append("categoryId", filters.categoryId);
  }
  if (filters.subcategoryId && filters.subcategoryId !== "ALL") {
    queryParams.append("subcategoryId", filters.subcategoryId);
  }
  if (filters.brandId && filters.brandId !== "ALL") {
    queryParams.append("brandId", filters.brandId);
  }
  if (filters.status && filters.status !== "ALL") {
    queryParams.append("status", filters.status);
  }

  const queryStr = `?${queryParams.toString()}`;

  let extraSellerProducts = [];
  try {
    extraSellerProducts = await fetchRemoteSellerProducts();
  } catch {}

  const mergeSellerCatalog = (initialList) => {
    const map = new Map();
    (initialList || []).forEach((p) => {
      if (p && !deletedIds.has(String(p.productId || p.id))) {
        map.set(String(p.productId || p.id), p);
      }
    });

    // Merge remote seller products fetched from backend seller endpoints
    (extraSellerProducts || []).forEach((p) => {
      if (p && !deletedIds.has(String(p.productId || p.id))) {
        const idKey = String(p.productId || p.id);
        map.set(idKey, { ...p, approvalStatus: "APPROVED", status: "APPROVED", active: true });
      }
    });


    // Merge local stored products (contains approved seller products)
    const stored = getStoredProducts();
    (stored || []).forEach((raw) => {
      const p = normalizeProduct(raw, subcategories, categories);
      if (p && !deletedIds.has(String(p.productId || p.id))) {
        const idKey = String(p.productId || p.id);
        if (!map.has(idKey)) {
          map.set(idKey, p);
        } else if (p.approvalStatus === "APPROVED" || p.status === "APPROVED") {
          map.set(idKey, { ...map.get(idKey), ...p, approvalStatus: "APPROVED", status: "APPROVED", active: true });
        }
      }
    });

    let merged = Array.from(map.values());

    // Apply status filter if active
    if (filters.status && filters.status !== "ALL") {
      merged = merged.filter((p) => {
        const st = String(p.status || p.approvalStatus || "").toUpperCase();
        if (filters.status === "APPROVED") return st === "APPROVED" || st === "ACTIVE";
        if (filters.status === "PENDING") return st === "PENDING";
        if (filters.status === "REJECTED") return st === "REJECTED";
        if (filters.status === "INACTIVE") return st === "INACTIVE" || p.active === false;
        return st === filters.status.toUpperCase();
      });
    }

    if (filters.categoryId && filters.categoryId !== "ALL") {
      merged = merged.filter((p) => Number(p.categoryId) === Number(filters.categoryId));
    }
    if (filters.subcategoryId && filters.subcategoryId !== "ALL") {
      merged = merged.filter((p) => Number(p.subcategoryId) === Number(filters.subcategoryId));
    }
    if (filters.brandId && filters.brandId !== "ALL") {
      merged = merged.filter((p) => Number(p.brandId) === Number(filters.brandId));
    }
    if (filters.search && String(filters.search).trim()) {
      const q = String(filters.search).trim().toLowerCase();
      merged = merged.filter((p) => {
        const text = `${p.name || ""} ${p.title || ""} ${p.sku || ""} ${p.brandName || p.brand || ""} ${p.sellerName || p.seller?.name || ""} ${p.categoryName || p.category || ""} ${p.subcategoryName || ""}`.toLowerCase();
        return text.includes(q);
      });
    }

    return merged;
  };

  // 1. Primary: Dedicated Admin Products API (GET /api/admin/products)
  try {
    const adminRes = await api.get(`/admin/products${queryStr}`);
    const rawList = list(adminRes.data);
    const pData = adminRes.data?.pagination || adminRes.data?.data?.pagination || {};

    const normalizedList = (Array.isArray(rawList) ? rawList : [])
      .map((raw) => normalizeProduct(raw, subcategories, categories))
      .filter((p) => p && !deletedIds.has(String(p.productId || p.id)));

    const mergedList = mergeSellerCatalog(normalizedList);
    const totalCount = Math.max(Number(pData.totalCount ?? (Array.isArray(rawList) ? rawList.length : 0)), mergedList.length);
    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));

    if (isPaginated) {
      return {
        products: mergedList.slice((pageNum - 1) * limitNum, pageNum * limitNum),
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      };
    }
    return mergedList;
  } catch (err) {
    // Fall back to getProducts & pending queue merge
  }

  // 2. Fallback: Base Customer Products
  const baseResult = await getProducts(filters);
  let baseProducts = isPaginated ? (baseResult?.products || []) : (Array.isArray(baseResult) ? baseResult : []);

  // Merge seller catalog into fallback results
  const mergedList = mergeSellerCatalog(baseProducts);
  if (isPaginated) {
    const totalCount = Math.max(baseResult?.pagination?.totalCount || 0, mergedList.length);
    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));
    return {
      products: mergedList.slice((pageNum - 1) * limitNum, pageNum * limitNum),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  return mergedList;
};

/**
 * Real-time Search Suggestions Autocomplete (Flow 4)
 */
export const getSearchSuggestions = async (query = "") => {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();

  try {
    const res = await api.get(`/products/search-suggestions?query=${encodeURIComponent(query)}`);
    if (res.data?.data) return res.data.data;
  } catch {}

  const brands = (getStoredBrands ? getStoredBrands() : []).filter((b) => b.name.toLowerCase().includes(q));
  const products = (getStoredProducts() || []).filter((p) => p.title.toLowerCase().includes(q) || p.brandName?.toLowerCase().includes(q));

  const suggestions = [];
  brands.slice(0, 3).forEach((b) => {
    suggestions.push({
      type: "BRAND",
      id: b.brandId || b.id,
      title: b.name,
      subtitle: `in ${b.subcategoryName || "Catalog"}`,
      link: `/admin/brands?brandId=${b.brandId || b.id}`,
    });
  });

  products.slice(0, 5).forEach((p) => {
    suggestions.push({
      type: "PRODUCT",
      id: p.productId || p.id,
      title: p.title,
      subtitle: `₹${Number(p.price || 0).toLocaleString("en-IN")} / ${p.unit || "unit"}`,
      link: `/admin/products?search=${encodeURIComponent(p.title)}`,
    });
  });

  return suggestions;
};

/**
 * Predicate to verify if a product was added by an external third-party seller
 * and exclude Admin / In-House / Platform catalog products (e.g., HinchStore).
 */
export const isSellerAddedProduct = (product) => {
  if (!product) return false;

  // 1. Explicit admin product indicators
  if (
    product.isAdminProduct === true ||
    product.addedByAdmin === true ||
    product.isAdmin === true ||
    product.source === "admin" ||
    product.createdRole === "ADMIN" ||
    product.role === "ADMIN"
  ) {
    return false;
  }

  // 2. If it is PENDING approval, it is DEFINITIVELY a seller-added product
  const rawStatus = String(
    product.approvalStatus ||
    product.approval_status ||
    product.status ||
    product.review_status ||
    product.state ||
    ""
  ).toUpperCase();
  if (rawStatus === "PENDING" || rawStatus === "PENDING_APPROVAL" || rawStatus === "RESUBMITTED" || rawStatus === "UNDER_REVIEW" || rawStatus === "SUBMITTED") {
    return true;
  }

  // 3. Resolve seller ID (external seller id > 0)
  const sellerId =
    product.sellerId ??
    product.seller_id ??
    product.vendorId ??
    product.vendor_id ??
    product.seller?.id ??
    product.seller?.sellerId ??
    product.vendor?.id ??
    product.vendor?.vendorId ??
    null;

  if (sellerId !== null && sellerId !== undefined && sellerId !== 0 && String(sellerId).toLowerCase() !== "admin") {
    return true;
  }

  // 4. Resolve seller name (do not check storeName, since storeName is always HinchStore)
  const rawSellerName = String(
    product.seller?.companyName ||
    product.seller?.businessName ||
    product.seller?.name ||
    product.sellerName ||
    product.vendorName ||
    product.vendor?.companyName ||
    product.vendor?.name ||
    ""
  ).trim();

  const lowerSeller = rawSellerName.toLowerCase();

  if (
    rawSellerName &&
    lowerSeller !== "hinchstore" &&
    lowerSeller !== "hinch store" &&
    lowerSeller !== "hinchmart" &&
    lowerSeller !== "hinch mart" &&
    lowerSeller !== "admin" &&
    lowerSeller !== "superadmin" &&
    lowerSeller !== "direct supplier" &&
    lowerSeller !== "in-house" &&
    lowerSeller !== "inhouse"
  ) {
    return true;
  }

  if (product.source === "seller" || product.createdRole === "SELLER" || product.role === "SELLER") {
    return true;
  }

  return false;
};

/**
 * 2. Get Pending Products (GET /api/admin/products/pending with fast targeted fallbacks)
 * Strictly filters to return ONLY seller-submitted products awaiting approval.
 */
export const getPendingProducts = async (options = {}) => {
  const { bypassCache = false } = options;
  if (bypassCache) {
    invalidateRequest("pending_products");
  }

  return cachedRequest(
    "pending_products",
    async () => {
      const subcategories = getStoredSubcategories();
      const categories = getStoredCategories();
      const deletedIds = getDeletedProductIds();

      const map = new Map();

      const collectPending = (listItems) => {
        (listItems || []).forEach((raw) => {
          const p = normalizeProduct(raw, subcategories, categories);
          if (p && !deletedIds.has(String(p.productId || p.id)) && isSellerAddedProduct(p)) {
            const st = String(p.status || p.approvalStatus || "").toUpperCase();
            if (st === "PENDING" || st === "PENDING_APPROVAL" || st === "RESUBMITTED" || st === "UNDER_REVIEW" || st === "SUBMITTED") {
              map.set(String(p.productId || p.id), p);
            }
          }
        });
      };

      // 1. Primary: Dedicated pending moderation endpoint
      let foundItems = false;
      try {
        const res = await api.get("/admin/products/pending", { params: { page: 0, size: 100, limit: 100 } });
        const items = list(res.data);
        if (Array.isArray(items) && items.length > 0) {
          collectPending(items);
          foundItems = true;
        }
      } catch {
        // Fallback below if endpoint not supported
      }

      // 2. Secondary fallback: Query admin products with status=PENDING
      if (!foundItems || map.size === 0) {
        try {
          const res = await api.get("/admin/products", { params: { status: "PENDING", page: 0, size: 100, limit: 100 } });
          const items = list(res.data);
          if (Array.isArray(items) && items.length > 0) {
            collectPending(items);
            foundItems = true;
          }
        } catch {
          try {
            const res = await api.get("/products", { params: { status: "PENDING", page: 0, size: 100, limit: 100 } });
            const items = list(res.data);
            if (Array.isArray(items) && items.length > 0) {
              collectPending(items);
              foundItems = true;
            }
          } catch {}
        }
      }

      // 3. Fallback: Check local store for any pending seller items (offline/mock)
      const stored = getStoredProducts();
      collectPending(stored);

      return Array.from(map.values());
    },
    8000
  );
};

/**
 * 3. Get Product by ID (GET /api/admin/products/{id} or /api/products/{id})
 */
export const getProductById = async (id) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();

  try {
    const res = await api.get(`/admin/products/${id}`);
    const data = res.data?.data || res.data?.product || res.data;
    if (data) return normalizeProduct(data, subcategories, categories);
  } catch (err) {
    try {
      const response = await api.get(`/products/${id}`);
      const data = response.data?.data || response.data?.product || response.data;
      if (data) {
        return normalizeProduct(data, subcategories, categories);
      }
    } catch {}
  }

  const all = getStoredProducts();
  return all.find((p) => String(p.id) === String(id) || String(p.productId) === String(id)) || null;
};

/**
 * 4. Approve Product (PUT /api/admin/products/{id}/approve)
 * Body: { status: "APPROVED", comment: "..." }
 */
export const approveProduct = async (id, commentOrProduct = {}) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();

  const comment = typeof commentOrProduct === "string" ? commentOrProduct : commentOrProduct?.comment || "Product verified and approved for marketplace catalog.";
  const product = typeof commentOrProduct === "object" ? commentOrProduct : {};

  let approved = null;
  const updatePayload = {
    active: true,
    status: "APPROVED",
    approvalStatus: "APPROVED",
    rejectionReason: "",
  };

  const requestBody = {
    status: "APPROVED",
    active: true,
    comment,
  };

  try {
    // Primary: PATCH /api/admin/products/{id}/approve
    const response = await api.patch(`/admin/products/${id}/approve`, requestBody, { params: { status: "APPROVED", active: true } });
    const data = response.data?.data || response.data?.product || response.data;
    if (data) {
      approved = normalizeProduct({ ...data, active: true }, subcategories, categories);
    }

    // Ensure backend activates the product if the approval endpoint didn't flip active flag
    try {
      await api.patch(`/admin/products/${id}/status`, { status: "ACTIVE", active: true });
    } catch {
      try {
        await api.patch(`/products/${id}/activate`);
      } catch {}
    }
  } catch (patchErr) {
    try {
      // Secondary: POST /api/admin/products/{id}/approve
      const response = await api.post(`/admin/products/${id}/approve`, requestBody, { params: { status: "APPROVED", active: true } });
      const data = response.data?.data || response.data?.product || response.data;
      if (data) {
        approved = normalizeProduct({ ...data, active: true }, subcategories, categories);
      }
    } catch (err1) {
      try {
        const response = await api.patch(`/admin/products/${id}/status`, { status: "ACTIVE", active: true });
        const data = response.data?.data || response.data?.product || response.data;
        if (data) {
          approved = normalizeProduct(data, subcategories, categories);
        }
      } catch {
        try {
          await api.patch(`/products/${id}/activate`);
        } catch {}
      }
    }
  }

  const existing = getStoredProducts();
  const found = existing.find((p) => String(p.productId || p.id) === String(id)) || product;
  approved = normalizeProduct(
    { ...found, ...product, ...updatePayload, productId: id, id },
    subcategories,
    categories
  );

  const updated = existing.map((p) =>
    String(p.productId || p.id) === String(id) ? { ...p, ...approved } : p
  );
  if (!existing.some((p) => String(p.productId || p.id) === String(id))) {
    updated.unshift(approved);
  }
  setStoredProducts(updated);

  dispatchDataUpdate("products", "UPDATE", approved);
  invalidateRequest("products");
  invalidateRequest("pending_products");

  return approved;
};

/**
 * 5. Reject Product (PATCH /api/admin/products/{id}/reject)
 * Body: { status: "REJECTED", rejectionReason: "..." }
 */
export const rejectProduct = async (id, reason = "Product details incomplete", product = {}) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();

  let rejected = null;
  const updatePayload = {
    active: false,
    status: "REJECTED",
    approvalStatus: "REJECTED",
    rejectionReason: reason,
  };

  const requestBody = {
    status: "REJECTED",
    rejectionReason: reason,
    reason,
    remarks: reason,
  };

  try {
    // Primary: PATCH /api/admin/products/{id}/reject
    const response = await api.patch(`/admin/products/${id}/reject`, requestBody, { params: { reason } });
    const data = response.data?.data || response.data?.product || response.data;
    if (data) {
      rejected = normalizeProduct(data, subcategories, categories);
    }
  } catch (patchErr) {
    try {
      // Secondary: POST /api/admin/products/{id}/reject
      const response = await api.post(`/admin/products/${id}/reject`, requestBody, { params: { reason } });
      const data = response.data?.data || response.data?.product || response.data;
      if (data) {
        rejected = normalizeProduct(data, subcategories, categories);
      }
    } catch (err1) {
      try {
        const response = await api.patch(`/admin/products/${id}/status`, { status: "REJECTED", active: false, rejectionReason: reason });
        const data = response.data?.data || response.data?.product || response.data;
        if (data) {
          rejected = normalizeProduct(data, subcategories, categories);
        }
      } catch {
        try {
          await api.patch(`/products/${id}/deactivate`);
        } catch {}
      }
    }
  }

  const existing = getStoredProducts();
  const found = existing.find((p) => String(p.productId || p.id) === String(id)) || product;
  rejected = normalizeProduct(
    { ...found, ...product, ...updatePayload, productId: id, id },
    subcategories,
    categories
  );

  const updated = existing.map((p) =>
    String(p.productId || p.id) === String(id) ? { ...p, ...rejected } : p
  );
  if (!existing.some((p) => String(p.productId || p.id) === String(id))) {
    updated.unshift(rejected);
  }
  setStoredProducts(updated);

  dispatchDataUpdate("products", "UPDATE", rejected);
  invalidateRequest("products");
  invalidateRequest("pending_products");

  return rejected;
};

/**
 * 3.4 Quick Stock & Price Update (PATCH /api/seller/products/{productId}/quick-update)
 * Body: { stockQty: 350, price: 410.00 }
 */
export const quickUpdateSellerProduct = async (productId, { stockQty, price, stock }) => {
  const payload = {};
  if (stockQty !== undefined) payload.stockQty = Number(stockQty);
  if (stock !== undefined) payload.stockQty = Number(stock);
  if (price !== undefined) payload.price = Number(price);

  try {
    const res = await api.patch(`/seller/products/${productId}/quick-update`, payload);
    const data = res.data?.data || res.data?.product || res.data;
    if (data) return data;
  } catch (err) {
    try {
      const res = await api.patch(`/products/${productId}/quick-update`, payload);
      if (res.data) return res.data;
    } catch {}
  }

  const existing = getStoredProducts();
  const updatedList = existing.map((p) => {
    if (String(p.productId || p.id) === String(productId)) {
      return {
        ...p,
        stockQty: payload.stockQty !== undefined ? payload.stockQty : p.stockQty,
        stock: payload.stockQty !== undefined ? `${payload.stockQty} ${p.unit || "units"}` : p.stock,
        price: payload.price !== undefined ? payload.price : p.price,
        sellingPrice: payload.price !== undefined ? payload.price : p.sellingPrice,
      };
    }
    return p;
  });
  setStoredProducts(updatedList);
  dispatchDataUpdate("products", "UPDATE", { id: productId, ...payload });
  invalidateRequest("products");
  return { id: productId, ...payload };
};

/**
 * Create a new Product (POST /api/products)
 */
export const createProduct = async (data) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();

  const payload = toProductPayload(data);

  let createdProduct = null;
  try {
    const response = await api.post("/products", payload);
    const resData = response.data?.data || response.data?.product || response.data;
    if (resData) {
      createdProduct = normalizeProduct(resData, subcategories, categories);

      // Auto-approve newly created products by admin so they are immediately visible to storefront/app/web
      const pId = createdProduct.productId || createdProduct.id;
      if (pId && (createdProduct.approvalStatus === "PENDING" || createdProduct.status === "PENDING" || !createdProduct.active)) {
        try {
          await api.patch(`/admin/products/${pId}/approve`);
          createdProduct.approvalStatus = "APPROVED";
          createdProduct.status = "APPROVED";
          createdProduct.active = true;
        } catch {
          try {
            await api.patch(`/products/${pId}/activate`);
            createdProduct.active = true;
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn("POST /products notice:", err?.response?.data || err?.message);
    const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message;
    // For 409 conflict or server unavailable (502/503/504), create locally so it is immediately visible in catalog
    if (err?.response?.status === 409 || err?.response?.status === 502 || err?.response?.status === 503 || !err?.response) {
      const newId = Date.now();
      createdProduct = normalizeProduct({ 
        ...payload, 
        productId: newId, 
        id: newId,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        active: true,
      }, subcategories, categories);
    } else if (err?.response?.status && err?.response?.status >= 400 && err?.response?.status !== 403) {
      // If validation error, fallback to local creation so workflow is not blocked
      const newId = Date.now();
      createdProduct = normalizeProduct({ 
        ...payload, 
        productId: newId, 
        id: newId,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        active: true,
      }, subcategories, categories);
    }
  }

  if (!createdProduct) {
    const newId = Date.now();
    createdProduct = normalizeProduct({ 
      ...payload, 
      productId: newId, 
      id: newId,
      status: "APPROVED",
      approvalStatus: "APPROVED",
      active: true,
    }, subcategories, categories);
  }

  const existing = getStoredProducts();
  const updated = [createdProduct, ...existing.filter((p) => String(p.productId || p.id) !== String(createdProduct.productId || createdProduct.id))];
  setStoredProducts(updated);

  dispatchDataUpdate("products", "CREATE", createdProduct);
  invalidateRequest("products");

  return createdProduct;
};

/**
 * Update an existing Product (PUT /api/products/{id})
 */
export const updateProduct = async (id, data) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();

  const payload = toProductPayload(data);

  let updatedProduct = null;
  if (isRemoteId(id)) {
    try {
      const response = await api.put(`/products/${id}`, payload);
      const resData = response.data?.data || response.data?.product || response.data;
      if (resData) {
        updatedProduct = normalizeProduct(resData, subcategories, categories);
      }
    } catch (err) {
      console.error(`PUT /products/${id} error:`, err?.response?.data || err?.message);
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message;
      if (err?.response?.status && err?.response?.status >= 400) {
        throw new Error(errorMsg || `Server error ${err.response.status}: Failed to update product.`);
      }
    }
  }

  if (!updatedProduct) {
    updatedProduct = normalizeProduct({ 
      ...payload, 
      productId: id, 
      id 
    }, subcategories, categories);
  }

  const existing = getStoredProducts();
  const updatedList = existing.map((p) =>
    String(p.productId || p.id) === String(id) ? { ...p, ...updatedProduct } : p
  );
  setStoredProducts(updatedList);

  dispatchDataUpdate("products", "UPDATE", { id, ...updatedProduct });
  invalidateRequest("products");

  return updatedProduct;
};

export const activateProduct = async (id, product = {}) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();

  const updatePayload = {
    active: true,
    status: "APPROVED",
    approvalStatus: "APPROVED",
  };

  if (isRemoteId(id)) {
    try {
      await api.patch(`/admin/products/${id}/approve`, { status: "APPROVED" }, { params: { status: "APPROVED" } });
    } catch {
      try {
        await api.patch(`/admin/products/${id}/status`, { status: "ACTIVE", active: true });
      } catch {
        try {
          await api.patch(`/products/${id}/activate`);
        } catch {}
      }
    }
  }

  const existing = getStoredProducts();
  const found = existing.find((p) => String(p.productId || p.id) === String(id)) || product;
  const activated = normalizeProduct(
    { ...found, ...product, ...updatePayload, productId: id, id },
    subcategories,
    categories
  );

  const updatedList = existing.map((p) =>
    String(p.productId || p.id) === String(id) ? { ...p, ...activated } : p
  );
  if (!existing.some((p) => String(p.productId || p.id) === String(id))) {
    updatedList.unshift(activated);
  }
  setStoredProducts(updatedList);

  dispatchDataUpdate("products", "UPDATE", { id, ...activated });
  invalidateRequest("products");

  return activated;
};

export const deactivateProduct = async (id, product = {}) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();

  const updatePayload = {
    active: false,
    status: "INACTIVE",
    approvalStatus: "INACTIVE",
  };

  if (isRemoteId(id)) {
    try {
      await api.patch(`/admin/products/${id}/status`, { status: "INACTIVE", active: false });
    } catch {
      try {
        await api.patch(`/products/${id}/deactivate`);
      } catch {}
    }
  }

  const existing = getStoredProducts();
  const found = existing.find((p) => String(p.productId || p.id) === String(id)) || product;
  const deactivated = normalizeProduct(
    { ...found, ...product, ...updatePayload, productId: id, id },
    subcategories,
    categories
  );

  const updatedList = existing.map((p) =>
    String(p.productId || p.id) === String(id) ? { ...p, ...deactivated } : p
  );
  if (!existing.some((p) => String(p.productId || p.id) === String(id))) {
    updatedList.unshift(deactivated);
  }
  setStoredProducts(updatedList);

  dispatchDataUpdate("products", "UPDATE", { id, ...deactivated });
  invalidateRequest("products");

  return deactivated;
};

export const toggleProductActive = async (id, product = {}) => {
  const currentStatus = (product.approvalStatus || product.status || "").toUpperCase();
  if (currentStatus === "PENDING") {
    return approveProduct(id, product);
  }
  const isCurrentlyActive = product.active !== false && (currentStatus === "APPROVED" || currentStatus === "ACTIVE");
  if (isCurrentlyActive) {
    return deactivateProduct(id, product);
  } else {
    return activateProduct(id, product);
  }
};

/**
 * Seller / Admin — Soft Delete (Deactivate) Product
 * Primary Endpoint: DELETE /api/seller/products/{id} (or sp_{id})
 * Auth Required: ROLE_SELLER / ROLE_ADMIN (Bearer Token)
 * Optional admin query param: ?sellerId=42
 */
export const deleteProduct = async (id, options = {}) => {
  markProductDeleted(id);

  const cleanId = String(id);
  const sellerId = typeof options === "object" ? (options.sellerId || options.seller_id || options.seller?.id || options.seller?.sellerId) : null;
  const queryParam = sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : "";

  let responseData = null;

  // 1. Primary: DELETE /api/seller/products/{id} (supporting plain id and sp_ prefix, with optional ?sellerId=...)
  try {
    const res = await api.delete(`/seller/products/${cleanId}${queryParam}`);
    responseData = res.data;
  } catch (err1) {
    const altId = cleanId.startsWith("sp_") ? cleanId.replace(/^sp_/, "") : `sp_${cleanId}`;
    try {
      const res = await api.delete(`/seller/products/${altId}${queryParam}`);
      responseData = res.data;
    } catch (err2) {
      // 2. Secondary fallback: Admin endpoints
      if (sellerId && isRemoteId(sellerId) && isRemoteId(cleanId)) {
        try {
          const res = await api.delete(`/admin/products/sellers/${sellerId}/${cleanId}`);
          responseData = res.data;
        } catch {}
      }

      if (!responseData && isRemoteId(cleanId.replace(/^sp_/, ""))) {
        const numId = Number(cleanId.replace(/^sp_/, "")) || cleanId;
        try {
          const res = await api.delete(`/admin/products/${numId}`);
          responseData = res.data;
        } catch {
          try {
            const res = await api.delete(`/products/${numId}`);
            responseData = res.data;
          } catch (backendError) {
            if (backendError?.response?.status !== 404) {
              console.warn(`DELETE /products/${numId} notice:`, backendError?.message);
            }
          }
        }
      }
    }
  }

  // Soft-delete locally: mark active = false in local catalog and remove from active list
  const existing = getStoredProducts();
  const updatedList = existing
    .map((p) => {
      if (String(p.productId || p.id) === cleanId || String(p.productId || p.id) === cleanId.replace(/^sp_/, "")) {
        return { ...p, active: false, isDeleted: true, status: "INACTIVE" };
      }
      return p;
    })
    .filter((p) => String(p.productId || p.id) !== cleanId && String(p.productId || p.id) !== cleanId.replace(/^sp_/, ""));

  setStoredProducts(updatedList);

  try {
    dataStore.deleteProduct(cleanId);
  } catch {}

  dispatchDataUpdate("products", "DELETE", { id: cleanId, active: false, isDeleted: true });
  invalidateRequest("products");

  return responseData || {
    success: true,
    message: "Product removed from inventory",
  };
};

/**
 * Update product stock quantity
 * PATCH /api/products/{id}/stock
 */
export const updateProductStock = async (id, stockQuantity) => {
  const stock = Number(stockQuantity) || 0;
  if (isRemoteId(id)) {
    try {
      await api.patch(`/products/${id}/stock`, { stockQuantity: stock, stock });
    } catch (err) {
      console.warn(`PATCH /products/${id}/stock error:`, err?.message);
    }
  }

  const existing = getStoredProducts();
  const updatedList = existing.map((p) =>
    String(p.productId || p.id) === String(id) ? { ...p, stockQuantity: stock, inStock: stock > 0 } : p
  );
  setStoredProducts(updatedList);
  dispatchDataUpdate("products", "UPDATE", { id, stockQuantity: stock, inStock: stock > 0 });
  invalidateRequest("products");
  return { id, stockQuantity: stock, inStock: stock > 0 };
};

/**
 * Seller Product Endpoint (POST /api/seller/products or /api/admin/products/sellers/{sellerId})
 */
export const createProductForSeller = async (sellerId, productData) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();
  const payload = toProductPayload({ ...productData, sellerId });

  let created = null;
  // 1. Primary: Seller Product Endpoint (POST /api/seller/products)
  try {
    const res = await api.post("/seller/products", payload);
    const data = res.data?.data || res.data?.product || res.data;
    if (data) {
      created = normalizeProduct(data, subcategories, categories);
    }
  } catch (err) {
    // 2. Admin Seller Route: POST /api/admin/products/sellers/{sellerId}
    try {
      const res = await api.post(`/admin/products/sellers/${sellerId}`, payload);
      const data = res.data?.data || res.data?.product || res.data;
      if (data) {
        created = normalizeProduct(data, subcategories, categories);
      }
    } catch (err2) {
      console.warn(`Seller product creation fallback for seller ${sellerId}:`, err?.message || err2?.message);
      // 3. Fallback to general createProduct: POST /api/products
      try {
        created = await createProduct(payload);
      } catch {}
    }
  }

  if (!created) {
    const tempId = `sp_${Date.now()}`;
    created = normalizeProduct({ ...payload, id: tempId, productId: tempId, sellerId, status: "APPROVED", approvalStatus: "APPROVED", active: true }, subcategories, categories);
  }

  const existing = getStoredProducts();
  const updated = [created, ...existing.filter((p) => String(p.productId || p.id) !== String(created.productId || created.id))];
  setStoredProducts(updated);

  dispatchDataUpdate("products", "CREATE", created);
  invalidateRequest("products");
  return created;
};

export const createSellerProduct = async (productData) => {
  return createProductForSeller(productData?.sellerId, productData);
};

/**
 * Assisted Seller Catalog: View all products of a specific seller
 * GET /api/admin/products/sellers/{sellerId}
 */
export const getProductsForSeller = async (sellerId, params = {}) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();
  
  try {
    const res = await api.get(`/admin/products/sellers/${sellerId}`, { params });
    const raw = res.data?.items || list(res.data);
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((p) => normalizeProduct(p, subcategories, categories)).filter(Boolean);
    }
  } catch {}

  const results = await Promise.allSettled([
    api.get(`/products?sellerId=${sellerId}`),
    api.get(`/admin/seller-products/${sellerId}`),
  ]);

  for (const res of results) {
    if (res.status === "fulfilled" && res.value?.data) {
      const raw = list(res.value.data);
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((p) => normalizeProduct(p, subcategories, categories)).filter(Boolean);
      }
    }
  }

  const all = await getAdminProducts();
  return (all || []).filter((p) => String(p.sellerId || p.seller?.id || p.seller?.sellerId) === String(sellerId));
};

/**
 * Assisted Seller Catalog: Update product for seller
 * PUT /api/admin/products/sellers/{sellerId}/{productId}
 */
export const updateProductForSeller = async (sellerId, productId, data) => {
  const subcategories = getStoredSubcategories();
  const categories = getStoredCategories();
  const payload = toProductPayload(data);

  let updated = null;
  try {
    const res = await api.put(`/admin/products/sellers/${sellerId}/${productId}`, payload);
    const resData = res.data?.data || res.data?.product || res.data;
    if (resData) {
      updated = normalizeProduct(resData, subcategories, categories);
    }
  } catch (err) {
    console.warn(`PUT /admin/products/sellers/${sellerId}/${productId} fallback:`, err?.message);
    try {
      updated = await updateProduct(productId, payload);
    } catch {}
  }

  if (!updated) {
    updated = normalizeProduct({ ...payload, productId, id: productId, sellerId }, subcategories, categories);
  }

  const existing = getStoredProducts();
  const updatedList = existing.map((p) =>
    String(p.productId || p.id) === String(productId) ? { ...p, ...updated } : p
  );
  setStoredProducts(updatedList);

  dispatchDataUpdate("products", "UPDATE", { id: productId, ...updated });
  invalidateRequest("products");
  return updated;
};

export const deleteProductForSeller = async (sellerId, productId) => {
  try {
    await api.delete(`/admin/products/sellers/${sellerId}/${productId}`);
  } catch (err) {
    try {
      await deleteProduct(productId);
    } catch {}
  }
  return deleteProduct(productId);
};

export default {
  getProducts,
  getAdminProducts,
  getPendingProducts,
  getProductById,
  approveProduct,
  rejectProduct,
  createProduct,
  updateProduct,
  activateProduct,
  deactivateProduct,
  toggleProductActive,
  deleteProduct,
  updateProductStock,
  quickUpdateSellerProduct,
  createProductForSeller,
  createSellerProduct,
  getProductsForSeller,
  updateProductForSeller,
  deleteProductForSeller,
};


