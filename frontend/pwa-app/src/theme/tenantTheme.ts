type TenantId = "rcme" | "royalpalm" | "bellagio";

const STORAGE_KEY = "app-tenant";
const DEFAULT_TENANT: TenantId = "rcme";

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

type TenantColors = {
  brand: { primary: string; accent: string; primarySoft?: string; accentSoft?: string };
  light: {
    background: string;
    surface0: string;
    surface1: string;
    surface2: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    borderSubtle: string;
    borderStrong: string;
    stateSuccess: string;
    stateWarning: string;
    stateError: string;
    stateInfo: string;
  };
  dark: {
    background: string;
    surface0: string;
    surface1: string;
    surface2: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    borderSubtle: string;
    borderStrong: string;
    stateSuccess: string;
    stateWarning: string;
    stateError: string;
    stateInfo: string;
  };
};

const TENANT_CONFIG: Record<TenantId, TenantColors> = {
  rcme: {
    brand: { primary: "#0f62fe", accent: "#d6c7a2", primarySoft: "#eef4ff", accentSoft: "#f1e7c9" },
    light: {
      background: "#f7f7f7",
      surface0: "#ffffff",
      surface1: "#f3f4f6",
      surface2: "#e5e7eb",
      textPrimary: "#1f2937",
      textSecondary: "#4b5563",
      textMuted: "#6b7280",
      borderSubtle: "#e5e7eb",
      borderStrong: "#d1d5db",
      stateSuccess: "#7fcf85",
      stateWarning: "#f2b35f",
      stateError: "#f58c8c",
      stateInfo: "#7fb2ff",
    },
    dark: {
      background: "#0f1115",
      surface0: "#11141a",
      surface1: "#161b22",
      surface2: "#1d232d",
      textPrimary: "#f7f9fc",
      textSecondary: "#c9d2e3",
      textMuted: "#93a1b6",
      borderSubtle: "#1f2834",
      borderStrong: "#2a3545",
      stateSuccess: "#7fcf85",
      stateWarning: "#f2b35f",
      stateError: "#f58c8c",
      stateInfo: "#7fb2ff",
    },
  },
  royalpalm: {
    brand: { primary: "#1b8f5a", accent: "#2dbf7a", primarySoft: "#e3f2ea", accentSoft: "#d5f3e3" },
    light: {
      background: "#f5faf6",
      surface0: "#ffffff",
      surface1: "#f0f5f1",
      surface2: "#e1ede4",
      textPrimary: "#103522",
      textSecondary: "#275c3c",
      textMuted: "#4a7a5f",
      borderSubtle: "#d4e3d8",
      borderStrong: "#b5ccbb",
      stateSuccess: "#3fa36a",
      stateWarning: "#e0b45c",
      stateError: "#d86f70",
      stateInfo: "#6ba8f5",
    },
    dark: {
      background: "#0f1712",
      surface0: "#111c14",
      surface1: "#152218",
      surface2: "#1c2c21",
      textPrimary: "#e8f3ea",
      textSecondary: "#c2d3c7",
      textMuted: "#90a697",
      borderSubtle: "#203528",
      borderStrong: "#2c4633",
      stateSuccess: "#4fce86",
      stateWarning: "#e7c06c",
      stateError: "#e1848a",
      stateInfo: "#80b9ff",
    },
  },
  bellagio: {
    brand: { primary: "#7b1f3d", accent: "#c84d71", primarySoft: "#f3e4ea", accentSoft: "#f7d9e3" },
    light: {
      background: "#f9f5f6",
      surface0: "#ffffff",
      surface1: "#f4eaed",
      surface2: "#e8d9df",
      textPrimary: "#29121b",
      textSecondary: "#4a2a38",
      textMuted: "#6b4b5b",
      borderSubtle: "#e2d2d8",
      borderStrong: "#c9b2bb",
      stateSuccess: "#73c58c",
      stateWarning: "#e4b25c",
      stateError: "#d65f66",
      stateInfo: "#6f9de8",
    },
    dark: {
      background: "#0f0a0c",
      surface0: "#120d10",
      surface1: "#181118",
      surface2: "#221825",
      textPrimary: "#f3e8ec",
      textSecondary: "#d7c0c8",
      textMuted: "#a88ca0",
      borderSubtle: "#261b22",
      borderStrong: "#33232e",
      stateSuccess: "#8cd3a2",
      stateWarning: "#e9c06e",
      stateError: "#e07a80",
      stateInfo: "#8ab2f5",
    },
  },
};

const applyTenantAttr = (tenant: TenantId) => {
  if (isBrowser) {
    document.documentElement.setAttribute("data-tenant", tenant);
  }
};

export const getDefaultTenant = (): TenantId => DEFAULT_TENANT;

export const getTenantConfig = (tenant: TenantId): TenantColors => TENANT_CONFIG[tenant];

export const getActiveTenant = (): TenantId => {
  if (!isBrowser) return DEFAULT_TENANT;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "rcme" || stored === "royalpalm" || stored === "bellagio") return stored;
  return DEFAULT_TENANT;
};

export const setActiveTenant = (tenant: TenantId) => {
  if (!TENANT_CONFIG[tenant]) return;
  if (isBrowser) {
    try {
      window.localStorage.setItem(STORAGE_KEY, tenant);
    } catch {
      // ignore
    }
  }
  applyTenantAttr(tenant);
};

export type { TenantId };

