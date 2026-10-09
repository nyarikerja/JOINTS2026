import React, { useState } from "react";
import { X, MapPin, Building2, ShieldAlert } from "lucide-react";
import { TabImpact } from "../tabs/TabImpact";
import { TabFacilities } from "../tabs/TabFacilities";
import { TabProtocolAI } from "../tabs/TabProtocolAI";
import type {
  ImpactResponse,
  FacilitiesImpactResponse,
  ValidationResponse,
  HazardType,
  SchoolItem
} from "../../types/api";

interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  impact: ImpactResponse | null;
  facilities: FacilitiesImpactResponse | null;
  validation: ValidationResponse | null;
  advisory?: any;
  hazard: HazardType;
  rainMm: number;
  onFlyTo: (lat: number, lng: number) => void;
  onDrawRoute: (s: SchoolItem) => void;
}

type TabType = "region" | "facilities" | "protocol";

export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = ({
  isOpen,
  onClose,
  impact,
  facilities,
  advisory,
  hazard,
  rainMm,
  onFlyTo,
  onDrawRoute
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("region");

  const tabs = [
    { id: "region", label: "Wilayah", icon: MapPin },
    { id: "facilities", label: "Fasilitas", icon: Building2 },
    { id: "protocol", label: "Protokol & AI", icon: ShieldAlert }
  ] as const;

  return (
    <aside
      className={`absolute top-0 right-0 w-[350px] max-w-full h-full backdrop-blur-xl z-[1050] flex flex-col shadow-2xl transition-transform duration-300 ease-out font-sans ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{
        background: "rgba(247, 243, 237, 0.97)",
        borderLeft: "2px solid #EB895B",
        color: "#2b211e"
      }}
    >
      {/* Header Drawer */}
      <div
        className="h-12 px-3.5 flex items-center justify-between shrink-0 border-b select-none"
        style={{
          borderColor: "rgba(43, 33, 30, 0.08)",
          background: "#ECE5DB"
        }}
      >
        <div>
          <h2 className="font-serif font-bold text-xs text-[#2b211e] leading-none">
            Proyeksi Dampak Bencana
          </h2>
          <span className="text-[10px] text-[#2b211e]/60 mt-0.5 block">
            Ansambel Multi-Bahaya 48 Jam
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded transition cursor-pointer hover:bg-black/5 text-[#2b211e]/70 hover:text-[#2b211e]"
          title="Tutup Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 3 Tab Navigation (Wilayah | Fasilitas | Protokol & Edukasi AI) */}
      <nav
        className="grid grid-cols-3 shrink-0 border-b select-none"
        style={{
          background: "rgba(236, 229, 219, 0.7)",
          borderColor: "rgba(43, 33, 30, 0.08)"
        }}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className="py-2.5 px-1 text-[11px] font-medium flex flex-col items-center gap-1 border-b-2 transition cursor-pointer hover:bg-black/5"
              style={
                isActive
                  ? {
                      borderColor: "#EB895B",
                      color: "#A14646",
                      background: "rgba(235, 137, 91, 0.12)",
                      fontWeight: 700
                    }
                  : {
                      borderColor: "transparent",
                      color: "rgba(43, 33, 30, 0.65)"
                    }
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {activeTab === "region" && (
          <TabImpact impact={impact} hazard={hazard} rainMm={rainMm} />
        )}
        {activeTab === "facilities" && (
          <TabFacilities
            schools={facilities?.schools || []}
            hospitals={facilities?.evacuation_referral_hospitals || facilities?.hospitals || facilities?.healthcare || []}
            onFlyTo={onFlyTo}
            onDrawRoute={onDrawRoute}
          />
        )}
        {activeTab === "protocol" && (
          <TabProtocolAI hazard={hazard} advisory={advisory} />
        )}
      </div>
    </aside>
  );
};
