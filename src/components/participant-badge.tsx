import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import logoUrl from "@/assets/logo.png";

export interface BadgeParticipant {
  id: string;
  full_name: string;
  organisation: string;
  registration_number: string;
  registration_type: "online" | "walk_in";
}

export interface BadgeConfig {
  event_name: string;
  logo_url: string | null;
  show_qr: boolean;
  show_registration_number: boolean;
  badge_font_size: number;
  primary_color: string;
  accent_color: string;
}

interface Props {
  participant: BadgeParticipant;
  settings: BadgeConfig;
}

/**
 * Conference badge - physical 100mm x 60mm landscape (XPrinter XP-DT427B).
 * Renders identically on screen (mm units) and printed page.
 */
export const ParticipantBadge = forwardRef<HTMLDivElement, Props>(function ParticipantBadge(
  { participant, settings },
  ref,
) {
  const logo = settings.logo_url || logoUrl;
  const typeLabel = participant.registration_type === "walk_in" ? "Walk-in" : "Delegate";

  return (
    <div
      ref={ref}
      className="badge-card"
      style={{
        borderTop: `4mm solid ${settings.primary_color}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "28mm 1fr",
          gap: "3mm",
          padding: "4mm 4mm 3mm 4mm",
          boxSizing: "border-box",
        }}
      >
        {/* Left: logo + type chip */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
          <img
            src={logo}
            alt=""
            style={{ width: "26mm", height: "26mm", objectFit: "contain", borderRadius: "50%" }}
          />
          <div
            style={{
              backgroundColor: settings.accent_color,
              color: "#0d1f1d",
              fontWeight: 700,
              fontSize: "3mm",
              letterSpacing: "0.4mm",
              textTransform: "uppercase",
              padding: "1mm 2.5mm",
              borderRadius: "5mm",
              marginTop: "1mm",
            }}
          >
            {typeLabel}
          </div>
        </div>

        {/* Right: event, name, org, QR + reg no */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              fontSize: "2.8mm",
              fontWeight: 600,
              color: settings.primary_color,
              letterSpacing: "0.4mm",
              textTransform: "uppercase",
            }}
          >
            {settings.event_name}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
            <div
              style={{
                fontSize: `${Math.max(settings.badge_font_size ?? 16, 12) * 0.38}mm`,
                fontWeight: 800,
                lineHeight: 1.05,
                color: "#0d1f1d",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              {participant.full_name}
            </div>
            <div
              style={{
                fontSize: "3.4mm",
                marginTop: "1.5mm",
                color: "#3f524f",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {participant.organisation}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            {settings.show_registration_number ? (
              <div
                style={{
                  fontSize: "2.8mm",
                  fontWeight: 700,
                  color: settings.primary_color,
                  fontFamily: "monospace",
                  letterSpacing: "0.3mm",
                }}
              >
                {participant.registration_number}
              </div>
            ) : (
              <span />
            )}
            {settings.show_qr ? (
              <div style={{ background: "white", padding: "0.5mm" }}>
                <QRCodeSVG
                  value={JSON.stringify({ id: participant.id, reg: participant.registration_number })}
                  size={56}
                  bgColor="#ffffff"
                  fgColor={settings.primary_color}
                  level="M"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});
