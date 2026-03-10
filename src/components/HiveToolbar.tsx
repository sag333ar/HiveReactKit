import React, { useState, useEffect } from "react";

import distriatorLogo from "../../public/images/distriator.png";
import checkinwithxyzLogo from "../../public/images/checkinwithxyz.png";
import hreplierLogo from "../../public/images/hreplier.png";
import hpollsLogo from "../../public/images/hpolls.png";
import hstatsLogo from "../../public/images/stats.png";
import hsnapsLogo from "../../public/images/hsnaps.png";
import threespeakLogo from "../../public/images/3speak.png";
import hivefestfactsLogo from "../../public/images/hivefestfacts.png";

export interface HiveToolbarProps {
  isDistriator?: boolean;
  isCheckinwithxyz?: boolean;
  isHreplier?: boolean;
  isHpolls?: boolean;
  isHstats?: boolean;
  isHsnaps?: boolean;
  isHiveFestFacts?: boolean;
  backgroundColor?: string;
  textColor?: string;
  borderTopColor?: string;
}

interface ToolbarItem {
  key: string;
  name: string;
  url: string;
  logo: string;
  visibilityKey?: keyof Omit<HiveToolbarProps, "backgroundColor">;
  alwaysVisible?: boolean;
  isAvatar?: boolean;
  avatarUrl?: string;
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  {
    key: "vote-witness-sagar",
    name: "Vote Witness Sagar",
    url: "https://vote.hive.uno/@sagarkothari88",
    logo: "",
    alwaysVisible: true,
    isAvatar: true,
    avatarUrl: "https://images.hive.blog/u/sagarkothari88/avatar",
  },
  {
    key: "vote-witness-threespeak",
    name: "Vote Witness 3Speak",
    url: "https://vote.hive.uno/@threespeak",
    logo: threespeakLogo,
    alwaysVisible: true,
  },
  {
    key: "distriator",
    name: "Distriator",
    url: "https://distriator.com/",
    logo: distriatorLogo,
    visibilityKey: "isDistriator",
  },
  {
    key: "checkinwithxyz",
    name: "CheckinWithXYZ",
    url: "https://checkinwith.xyz/",
    logo: checkinwithxyzLogo,
    visibilityKey: "isCheckinwithxyz",
  },
  {
    key: "hreplier",
    name: "HReplier",
    url: "https://hreplier.sagarkothari88.one/",
    logo: hreplierLogo,
    visibilityKey: "isHreplier",
  },
  {
    key: "hpolls",
    name: "HPolls",
    url: "https://hpolls.sagarkothari88.one/",
    logo: hpollsLogo,
    visibilityKey: "isHpolls",
  },
  {
    key: "hstats",
    name: "HStats",
    url: "https://hstats.sagarkothari88.one/",
    logo: hstatsLogo,
    visibilityKey: "isHstats",
  },
  {
    key: "hsnaps",
    name: "HSnaps",
    url: "https://hsnaps.sagarkothari88.one/",
    logo: hsnapsLogo,
    visibilityKey: "isHsnaps",
  },
  {
    key: "3speak",
    name: "3Speak",
    url: "https://3speak.tv/",
    logo: threespeakLogo,
    alwaysVisible: true,
  },
  {
    key: "hivefestfacts",
    name: "HiveFestFacts",
    url: "https://hivefestfacts.sagarkothari88.one/",
    logo: hivefestfactsLogo,
    visibilityKey: "isHiveFestFacts",
  },
];

type ScreenSize = "mobile" | "tablet" | "desktop";

function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>("desktop");

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) setScreenSize("mobile");
      else if (w < 768) setScreenSize("tablet");
      else setScreenSize("desktop");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return screenSize;
}

const sizeConfig = {
  mobile: { icon: 28, fontSize: 8, padding: "4px 6px", gap: 2, barPadding: "4px", minWidth: 52, maxWidth: 68 },
  tablet: { icon: 30, fontSize: 8, padding: "4px 5px", gap: 3, barPadding: "5px 6px", minWidth: 56, maxWidth: 72 },
  desktop: { icon: 32, fontSize: 9, padding: "4px 6px", gap: 4, barPadding: "6px 8px", minWidth: 60, maxWidth: 80 },
};

const HiveToolbar: React.FC<HiveToolbarProps> = ({
  isDistriator = true,
  isCheckinwithxyz = true,
  isHreplier = true,
  isHpolls = true,
  isHstats = true,
  isHsnaps = true,
  isHiveFestFacts = true,
  backgroundColor = "#ffffff",
  textColor = "#4b5563",
  borderTopColor = "#e2e8f0",
}) => {
  const screenSize = useScreenSize();
  const sizes = sizeConfig[screenSize];

  const visibilityMap: Omit<HiveToolbarProps, "backgroundColor"> = {
    isDistriator,
    isCheckinwithxyz,
    isHreplier,
    isHpolls,
    isHstats,
    isHsnaps,
    isHiveFestFacts,
  };

  const visibleItems = TOOLBAR_ITEMS.filter(
    (item) => item.alwaysVisible || visibilityMap[item.visibilityKey!] !== false
  );

  if (visibleItems.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor,
        borderTop: `1px solid ${borderTopColor}`,
        boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: screenSize === "desktop" ? "center" : "flex-start",
          overflowX: "auto",
          overflowY: "hidden",
          whiteSpace: "nowrap",
          padding: sizes.barPadding,
          gap: `${sizes.gap}px`,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
        className="hive-toolbar-scroll"
      >
        {visibleItems.map((item) => (
          <a
            key={item.key}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              color: textColor,
              padding: sizes.padding,
              borderRadius: "8px",
              transition: "background-color 0.2s, transform 0.2s",
              cursor: "pointer",
              flexShrink: 0,
              minWidth: `${sizes.minWidth}px`,
              maxWidth: `${sizes.maxWidth}px`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#f3f4f6";
              (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            {item.isAvatar ? (
              <img
                src={item.avatarUrl}
                alt={item.name}
                style={{
                  width: `${sizes.icon}px`,
                  height: `${sizes.icon}px`,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <img
                src={item.logo}
                alt={item.name}
                style={{
                  width: `${sizes.icon}px`,
                  height: `${sizes.icon}px`,
                  borderRadius: "8px",
                  objectFit: "contain",
                }}
              />
            )}
            <span
              style={{
                fontSize: `${sizes.fontSize}px`,
                fontWeight: 500,
                marginTop: "2px",
                textAlign: "center",
                lineHeight: "1.2",
                whiteSpace: "normal",
                wordWrap: "break-word",
                color: textColor,
                maxWidth: `${sizes.maxWidth}px`,
                display: "block",
              }}
            >
              {item.name}
            </span>
          </a>
        ))}
      </div>
      <style>{`
        .hive-toolbar-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default HiveToolbar;
