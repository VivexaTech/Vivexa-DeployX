import { ImageResponse } from "next/og";

export const alt = "Vivexa DeployX — Deploy. Manage. Scale.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#09090b",
          color: "#f4f4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "#f4f4f5", display: "flex" }} />
          <span style={{ color: "#a1a1aa" }}>Vivexa</span>
          <span style={{ fontWeight: 700 }}>DeployX</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            Deploy your projects without the complexity.
          </div>
          <div style={{ marginTop: 24, fontSize: 30, color: "#a1a1aa" }}>Deploy. Manage. Scale.</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#71717a" }}>deployx.vivexatech.in · Powered by Vivexa Tech</div>
      </div>
    ),
    size,
  );
}
