import React, { useState } from "react";
import { X, MapPin, Buildings, ShieldWarning } from "@phosphor-icons/react";
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
  currentHour?: number;
  rainMm: number;
  onOpenLegend?: () => void;
  onFlyTo: (lat: number, lng: number) => void;
  onDrawRoute: (s: SchoolItem) => void;
  activeRouteId?: string;
  simulatedEventName?: string;
  onOpenGpsModal?: () => void;
}

type TabType = "region" | "facilities" | "protocol";

export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = ({
  isOpen,
  onClose,
  impact,
  facilities,
  advisory,
  hazard,
  currentHour = 12,
  rainMm,
  onOpenLegend,
  onFlyTo,
  onDrawRoute,
  activeRouteId,
  simulatedEventName,
  onOpenGpsModal
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("region");

  const tabs = [
    { id: "region", label: "Wilayah", icon: MapPin },
    { id: "facilities", label: "Fasilitas", icon: Buildings },
    { id: "protocol", label: "Protokol & AI", icon: ShieldWarning }
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
      {/* Tab Navigation (Wilayah | Fasilitas | Protokol & AI) + Tombol Tutup */}
      <div
        className="flex items-stretch shrink-0 border-b select-none"
        style={{
          background: "rgba(236, 229, 219, 0.85)",
          borderColor: "rgba(43, 33, 30, 0.1)"
        }}
      >
        <nav className="grid grid-cols-3 flex-1">
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
                <Icon size={16} weight={isActive ? "duotone" : "regular"} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tombol Tutup Panel Minimalis */}
        <button
          type="button"
          onClick={onClose}
          className="w-10 flex items-center justify-center transition cursor-pointer hover:bg-black/10 text-[#2b211e]/70 hover:text-[#2b211e] border-l border-black/10"
          title="Tutup Panel"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      {/* Content Body */}
      <div className={`flex-1 ${!impact ? "flex flex-col" : "overflow-y-auto p-3.5 custom-scrollbar"}`}>
        {!impact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-80 -translate-y-8">
            <div className="w-16 h-16 bg-[#2b211e]/5 rounded-full flex items-center justify-center mb-4">
              <ShieldWarning size={32} weight="duotone" className="text-[#2b211e]/40" />
            </div>
            <h3 className="font-bold text-[#2b211e] mb-1">Simulasi Belum Dijalankan</h3>
            <p className="text-[11px] text-[#2b211e]/70 leading-relaxed max-w-[260px]">
              Silakan pilih kejadian di Pusat Kendali lalu tekan <strong>Mulai Simulasi</strong> untuk melihat proyeksi dampak.
            </p>
          </div>
        ) : (
          <>
            {activeTab === "region" && (
              <TabImpact
                impact={impact}
                hazard={hazard}
                rainMm={rainMm}
                currentHour={currentHour}
                onOpenLegend={onOpenLegend}
                simulatedEventName={simulatedEventName}
              />
            )}
            {activeTab === "facilities" && (
              <TabFacilities
                schools={facilities?.schools || []}
                hospitals={facilities?.evacuation_referral_hospitals || facilities?.hospitals || facilities?.healthcare || []}
                currentHour={currentHour}
                onFlyTo={onFlyTo}
                onDrawRoute={onDrawRoute}
                activeRouteId={activeRouteId}
              />
            )}
            {activeTab === "protocol" && (
              <TabProtocolAI
                hazard={hazard}
                advisory={advisory}
                placeName={simulatedEventName}
                onOpenGpsModal={onOpenGpsModal}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
};
