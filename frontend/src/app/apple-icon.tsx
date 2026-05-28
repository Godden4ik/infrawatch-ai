import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0B10",
          borderRadius: 34,
          position: "relative",
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            position: "absolute",
            inset: 18,
            border: "1px solid rgba(63, 63, 70, 0.9)",
            borderRadius: 30,
          }}
        />
        {/* Cardinal marker stubs */}
        <div
          style={{
            position: "absolute",
            top: 32,
            left: "50%",
            transform: "translateX(-50%)",
            width: 8,
            height: 22,
            background: "#8B5CF6",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            width: 8,
            height: 22,
            background: "#8B5CF6",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 32,
            top: "50%",
            transform: "translateY(-50%)",
            width: 22,
            height: 8,
            background: "#8B5CF6",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 32,
            top: "50%",
            transform: "translateY(-50%)",
            width: 22,
            height: 8,
            background: "#8B5CF6",
          }}
        />
        {/* Center glow */}
        <div
          style={{
            position: "absolute",
            width: 80,
            height: 80,
            borderRadius: 999,
            background: "rgba(139, 92, 246, 0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />
        {/* Center dot */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            background: "#8B5CF6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#10B981",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
