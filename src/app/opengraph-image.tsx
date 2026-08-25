import { ImageResponse } from "next/og";

export const alt = "PluginWorld — One port for every plugin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** SOCIAL BANNER：品牌营销应用 "Plug in. The world is ready." */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#16161a",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="34" fill="none" stroke="#f7f6f3" strokeWidth="9" />
            <rect x="42" y="2" width="12" height="28" rx="5" fill="#16161a" />
            <rect x="42" y="6" width="12" height="24" rx="5" fill="#c6ff00" />
            <circle cx="48" cy="48" r="8" fill="#f7f6f3" />
          </svg>
          <span style={{ color: "#f7f6f3", fontSize: 40, fontWeight: 700 }}>
            PluginWorld
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ color: "#f7f6f3", fontSize: 88, fontWeight: 800, lineHeight: 1.05 }}>
            Plug in.
          </span>
          <span style={{ color: "#c6ff00", fontSize: 88, fontWeight: 800, lineHeight: 1.05 }}>
            The world is ready.
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#9a988f", fontSize: 26, letterSpacing: 2 }}>
            DSH · CLAUDE CODE · MCP — ONE PORT
          </span>
          <span style={{ color: "#9a988f", fontSize: 26, letterSpacing: 2 }}>
            WWW.PLUGINWORLD.AI
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
