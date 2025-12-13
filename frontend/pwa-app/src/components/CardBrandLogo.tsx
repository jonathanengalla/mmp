import React from "react";
import { getCardBrandLabel } from "../utils/cardBrand";

interface CardBrandLogoProps {
  brand: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * CardBrandLogo component displays card brand logos with text fallback
 * Supports: Visa, Mastercard, Amex, Discover, JCB, Diners Club, UnionPay
 * Falls back to text badge for unknown brands
 */
export const CardBrandLogo: React.FC<CardBrandLogoProps> = ({ 
  brand, 
  size = "md",
  className = "",
  style = {}
}) => {
  const normalizedBrand = brand?.toLowerCase().trim() || "";
  const label = getCardBrandLabel(brand);

  // Size mappings
  const sizeMap = {
    sm: { width: 32, height: 20 },
    md: { width: 40, height: 28 },
    lg: { width: 48, height: 32 },
  };

  const dimensions = sizeMap[size];

  // Render logo for known brands, fallback to text
  const renderLogo = () => {
    switch (normalizedBrand) {
      case "visa":
      case "vis":
        return <VisaLogo width={dimensions.width} height={dimensions.height} />;
      
      case "mastercard":
      case "master card":
      case "master":
      case "mast":
        return <MastercardLogo width={dimensions.width} height={dimensions.height} />;
      
      case "american express":
      case "amex":
      case "amex express":
        return <AmexLogo width={dimensions.width} height={dimensions.height} />;
      
      case "discover":
      case "disc":
        return <DiscoverLogo width={dimensions.width} height={dimensions.height} />;
      
      case "jcb":
        return <JCBLogo width={dimensions.width} height={dimensions.height} />;
      
      case "diners club":
      case "diners":
        return <DinersLogo width={dimensions.width} height={dimensions.height} />;
      
      case "unionpay":
      case "union pay":
      case "up":
        return <UnionPayLogo width={dimensions.width} height={dimensions.height} />;
      
      default:
        // Fallback to text badge
        return (
          <div
            style={{
              width: dimensions.width,
              height: dimensions.height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size === "sm" ? "0.65rem" : size === "md" ? "0.75rem" : "0.85rem",
              fontWeight: "var(--font-weight-bold, 700)",
              color: "var(--app-color-text-secondary, #666)",
              letterSpacing: "0.5px",
            }}
          >
            {label}
          </div>
        );
    }
  };

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
      role="img"
      aria-label={`${brand || "Card"} brand logo`}
    >
      {renderLogo()}
    </div>
  );
};

// SVG Logo Components
// Simplified, recognizable versions of card brand logos

const VisaLogo: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    {/* White background */}
    <rect width="80" height="50" rx="4" fill="white" />
    {/* Dark blue band at top */}
    <rect width="80" height="12" rx="4" fill="#1434CB" />
    {/* VISA text in dark blue */}
    <text
      x="40"
      y="30"
      fontSize="20"
      fontWeight="700"
      fill="#1434CB"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      letterSpacing="1.5"
    >
      VISA
    </text>
    {/* Orange stripe below text */}
    <rect x="8" y="36" width="64" height="2" fill="#F79E1B" rx="1" />
  </svg>
);

const MastercardLogo: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    <defs>
      {/* Pattern for horizontal stripes in overlap area */}
      <pattern id="mastercard-stripes" x="0" y="0" width="1.5" height="1" patternUnits="userSpaceOnUse">
        <rect width="0.75" height="1" fill="#EB001B" />
        <rect x="0.75" width="0.75" height="1" fill="#FF5F00" />
      </pattern>
      {/* Clip path for the intersection area (where both circles overlap) */}
      <clipPath id="intersection-clip">
        <circle cx="28" cy="25" r="16" />
        <circle cx="52" cy="25" r="16" />
      </clipPath>
    </defs>
    
    {/* White background */}
    <rect width="80" height="50" rx="4" fill="white" />
    
    {/* Left circle (red #EB001B) - larger for better proportion */}
    <circle cx="28" cy="25" r="16" fill="#EB001B" />
    
    {/* Right circle (orange #FF5F00) - overlaps with left circle */}
    <circle cx="52" cy="25" r="16" fill="#FF5F00" />
    
    {/* Striped pattern clipped to the intersection area */}
    <g clipPath="url(#intersection-clip)">
      <rect x="12" y="9" width="56" height="32" fill="url(#mastercard-stripes)" />
    </g>
    
    {/* MasterCard text in white across the circles */}
    <text
      x="40"
      y="28"
      fontSize="13"
      fontWeight="700"
      fill="white"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      letterSpacing="0.3"
    >
      MasterCard
    </text>
  </svg>
);

const AmexLogo: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    <rect width="80" height="50" rx="4" fill="#006FCF" />
    <text
      x="40"
      y="32"
      fontSize="18"
      fontWeight="700"
      fill="white"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      letterSpacing="1"
    >
      AMEX
    </text>
  </svg>
);

const DiscoverLogo: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    <rect width="80" height="50" rx="4" fill="#FF6000" />
    {/* Discover logo: orange background with white circle and text */}
    <circle cx="20" cy="25" r="7" fill="white" />
    <text
      x="50"
      y="32"
      fontSize="16"
      fontWeight="700"
      fill="white"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      letterSpacing="0.5"
    >
      DISCOVER
    </text>
  </svg>
);

const JCBLogo: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    <rect width="80" height="50" rx="4" fill="#0E4C96" />
    <text
      x="40"
      y="32"
      fontSize="20"
      fontWeight="700"
      fill="white"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      letterSpacing="2"
    >
      JCB
    </text>
  </svg>
);

const DinersLogo: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    <rect width="80" height="50" rx="4" fill="#0079BE" />
    <text
      x="40"
      y="32"
      fontSize="16"
      fontWeight="700"
      fill="white"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      letterSpacing="1"
    >
      DINERS
    </text>
  </svg>
);

const UnionPayLogo: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    <rect width="80" height="50" rx="4" fill="#E21836" />
    <text
      x="40"
      y="32"
      fontSize="16"
      fontWeight="700"
      fill="white"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      letterSpacing="1"
    >
      UNIONPAY
    </text>
  </svg>
);

