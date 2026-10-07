/**
 * app.js - Pusat Kendali Telemetri & Simulasi Bahaya Atmosfer Nasional (UdaraSiaga Indonesia)
 * Desain Enterprise Berstandar Otoritatif (MAGMA PVMBG & BMKG)
 * Tanpa framework (Vanilla JS) - Ringan, Tanggap Bencana & Cepat
 */

const API_BASE = window.location.origin.startsWith("http") ? window.location.origin : "http://127.0.0.1:8000";

// State Global Peta & Simulasi
let map;
let currentRunId = null;
let currentHazard = "volcano";
let currentTiersLayer = null;
let currentKrbCircle = null;
let facilitiesLayer = null;
let hotspotsLayer = null;
let volcanoesLayer = null;
let forestsLayer = null;
let currentHourlyTiersCache = {};
let timePlayInterval = null;
let allVolcanoesData = [];

// =============================================================================
// 1. Inisialisasi Peta & Basemap
// =============================================================================
function initMap() {
  // Tampilan Default: Seluruh Wilayah Kedaulatan Republik Indonesia
  map = L.map("map", {
    center: [-2.5, 118.0],
    zoom: 5,
    minZoom: 4,
    maxZoom: 16,
    zoomControl: true
  });

  // Basemap Bebas Kunci: OpenStreetMap dengan Filter Gelap Taktis
  const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors | Data: PVMBG Badan Geologi &bull; NASA FIRMS &bull; Open-Meteo",
    className: "dark-tiles",
    maxZoom: 18
  });
  tileLayer.addTo(map);

  // Coastline Fallback jika offline
  fetch(`${API_BASE}/layers/coastline`)
    .then(r => r.json())
    .then(geo => {
      L.geoJSON(geo, {
        style: { color: "#334155", weight: 1.2, opacity: 0.5 }
      }).addTo(map);
    })
    .catch(() => {});

  // Muat Lapisan-lapisan Nasional (Peta Bersih & Persisten)
  loadNationalVolcanoes();
  loadNationalForests();
  loadHotspots();
  loadFacilities();
  loadSummaryKpi();
  startClocks();
  updatePlumeLegend("volcano");
}

// Reset Tampilan Peta ke Skala Nasional Indonesia
function resetToIndonesiaView() {
  map.flyTo([-2.5, 118.0], 5, { duration: 1.2 });
}

// =============================================================================
// 2. Telemetri Real-Time, Jam Digital (WIB & UTC) & Ringkasan KPI
// =============================================================================
function startClocks() {
  function updateTime() {
    const now = new Date();
    
    // Waktu Indonesia Barat (WIB = UTC+7)
    const wibOptions = { timeZone: "Asia/Jakarta", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" };
    const wibStr = now.toLocaleTimeString("id-ID", wibOptions);
    const wibEl = document.getElementById("liveClockWib");
    if (wibEl) wibEl.textContent = `${wibStr} WIB`;

    // Waktu Universal Terkoordinasi (UTC)
    const utcHours = String(now.getUTCHours()).padStart(2, "0");
    const utcMinutes = String(now.getUTCMinutes()).padStart(2, "0");
    const utcSeconds = String(now.getUTCSeconds()).padStart(2, "0");
    const utcEl = document.getElementById("liveClockUtc");
    if (utcEl) utcEl.textContent = `${utcHours}:${utcMinutes}:${utcSeconds} UTC`;
  }
  updateTime();
  setInterval(updateTime, 1000);
}

function loadSummaryKpi() {
  fetch(`${API_BASE}/layers/summary-kpi`)
    .then(r => r.json())
    .then(kpi => {
      if (kpi.volcanoes) {
        const highAlertCount = (kpi.volcanoes.level_4_awas || 0) + (kpi.volcanoes.level_3_siaga || 0);
        const volcCountEl = document.getElementById("kpiVolcanoCount");
        if (volcCountEl) volcCountEl.textContent = highAlertCount;
      }
      if (kpi.wildfire_hotspots) {
        const fireCountEl = document.getElementById("kpiFireCount");
        if (fireCountEl) fireCountEl.textContent = Number(kpi.wildfire_hotspots.active_24h_firms || 0).toLocaleString();
      }
    })
    .catch(() => {});
}

// =============================================================================
// 3. Lapisan Gunungapi Nasional PVMBG (70 Gunung Aktif Se-Indonesia)
// =============================================================================
function createVolcanoSvgIcon(color, level) {
  const isPulsing = level >= 3;
  const pulseClass = level === 4 ? "volcano-pulse-ring" : (level === 3 ? "volcano-pulse-ring lvl-3" : "");
  const pulseHtml = isPulsing ? `<span class="${pulseClass}"></span>` : "";

  return L.divIcon({
    className: "volcano-div-icon",
    html: `
      <div class="volcano-marker-pin">
        ${pulseHtml}
        <svg class="volcano-svg-icon" width="22" height="22" viewBox="0 0 24 24">
          <polygon points="12,2 2,21 22,21" fill="${color}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="12" cy="14" r="2.8" fill="#111513"/>
        </svg>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 14],
    popupAnchor: [0, -14]
  });
}

function loadNationalVolcanoes() {
  fetch(`${API_BASE}/layers/volcanoes-national`)
    .then(r => r.json())
    .then(geo => {
      allVolcanoesData = geo.features || [];
      populateVolcanoDropdown(allVolcanoesData);
      renderVolcanoMarkers(allVolcanoesData);
    })
    .catch(err => console.error("Gagal memuat gunungapi nasional:", err));
}

const NATIONAL_KARHUTLA_EVENTS = [
  // Sumatera (8 Kawasan Hutan & Gambut)
  { id: "hutan_tesso_nilo", name: "TN Tesso Nilo (Pelalawan, Riau)", forest_type: "Gambut & Hutan Hujan", province: "Riau", region: "Sumatera", lat: -0.08, lon: 101.62, area_ha: 81700, risk: "Sangat Rawan", n_hotspots: 0 },
  { id: "hutan_giam_siak", name: "SM Giam Siak Kecil (Bengkalis & Siak, Riau)", forest_type: "Cagar Biosfer Gambut", province: "Riau", region: "Sumatera", lat: 1.18, lon: 101.88, area_ha: 178722, risk: "Sangat Rawan", n_hotspots: 0 },
  { id: "hutan_berbak", name: "TN Berbak (Tanjung Jabung Timur, Jambi)", forest_type: "Rawa Gambut Terbesar", province: "Jambi", region: "Sumatera", lat: -1.42, lon: 104.28, area_ha: 142750, risk: "Sangat Rawan", n_hotspots: 60 },
  { id: "hutan_padang_sugihan", name: "SM Padang Sugihan (OKI, Sumsel)", forest_type: "Suaka Gambut Dalam", province: "Sumatera Selatan", region: "Sumatera", lat: -3.22, lon: 105.12, area_ha: 88000, risk: "Sangat Rawan", n_hotspots: 60 },
  { id: "hutan_meranti_pesisir", name: "KHG Tebing Tinggi (Kep. Meranti, Riau)", forest_type: "Gambut Pesisir", province: "Riau", region: "Sumatera", lat: 0.95, lon: 102.72, area_ha: 110000, risk: "Rawan", n_hotspots: 0 },
  { id: "hutan_bukit_tigapuluh", name: "TN Bukit Tiga Puluh (Inhu, Riau/Jambi)", forest_type: "Hutan Bukit Tropis", province: "Riau", region: "Sumatera", lat: -0.85, lon: 102.45, area_ha: 144223, risk: "Waspada", n_hotspots: 13 },
  { id: "hutan_kerinci_seblat", name: "TN Kerinci Seblat (Jambi & Sumbar)", forest_type: "Hutan Pegunungan", province: "Jambi", region: "Sumatera", lat: -2.15, lon: 101.45, area_ha: 1375350, risk: "Waspada", n_hotspots: 1 },
  { id: "hutan_way_kambas", name: "TN Way Kambas (Lampung Timur)", forest_type: "Hutan Dataran Rendah", province: "Lampung", region: "Sumatera", lat: -4.95, lon: 105.75, area_ha: 125621, risk: "Rawan", n_hotspots: 60 },

  // Kalimantan (10 Kawasan Hutan & Gambut)
  { id: "hutan_sebangau", name: "TN Sebangau (Palangka Raya, Kalteng)", forest_type: "Rawa Gambut Tropis", province: "Kalimantan Tengah", region: "Kalimantan", lat: -2.55, lon: 113.85, area_ha: 568700, risk: "Sangat Rawan", n_hotspots: 0 },
  { id: "hutan_eks_plg", name: "KHG Eks-PLG Sejuta Ha (Pulang Pisau, Kalteng)", forest_type: "Gambut Kritis", province: "Kalimantan Tengah", region: "Kalimantan", lat: -2.85, lon: 114.25, area_ha: 1000000, risk: "Sangat Rawan", n_hotspots: 15 },
  { id: "hutan_tanjung_puting", name: "TN Tanjung Puting (Kobar, Kalteng)", forest_type: "Rawa Gambut & Hutan Tropis", province: "Kalimantan Tengah", region: "Kalimantan", lat: -3.05, lon: 111.95, area_ha: 415040, risk: "Rawan", n_hotspots: 37 },
  { id: "hutan_gunung_palung", name: "TN Gunung Palung (Ketapang, Kalbar)", forest_type: "Rawa Gambut & Bukit", province: "Kalimantan Barat", region: "Kalimantan", lat: -1.25, lon: 110.15, area_ha: 90000, risk: "Rawan", n_hotspots: 11 },
  { id: "hutan_kubu_raya", name: "Lahan Gambut Rasau Jaya (Kubu Raya, Kalbar)", forest_type: "Gambut Pesisir Asap", province: "Kalimantan Barat", region: "Kalimantan", lat: -0.35, lon: 109.45, area_ha: 145000, risk: "Sangat Rawan", n_hotspots: 0 },
  { id: "hutan_danau_sentarum", name: "TN Danau Sentarum (Kapuas Hulu, Kalbar)", forest_type: "Lahan Basah Ramsar", province: "Kalimantan Barat", region: "Kalimantan", lat: 0.85, lon: 112.15, area_ha: 132000, risk: "Waspada", n_hotspots: 8 },
  { id: "hutan_meratus", name: "Hutan Lindung Peg. Meratus (Hulu Sungai, Kalsel)", forest_type: "Hutan Pegunungan", province: "Kalimantan Selatan", region: "Kalimantan", lat: -2.75, lon: 115.55, area_ha: 180000, risk: "Waspada", n_hotspots: 54 },
  { id: "hutan_banjarbaru", name: "Lahan Gambut Landasan Ulin (Banjarbaru, Kalsel)", forest_type: "Gambut Kering Ring Bandara", province: "Kalimantan Selatan", region: "Kalimantan", lat: -3.48, lon: 114.78, area_ha: 45000, risk: "Sangat Rawan", n_hotspots: 39 },
  { id: "hutan_kutai", name: "TN Kutai (Kutai Timur & Bontang, Kaltim)", forest_type: "Hutan Ulin Tropis", province: "Kalimantan Timur", region: "Kalimantan", lat: 0.25, lon: 117.25, area_ha: 198629, risk: "Waspada", n_hotspots: 51 },
  { id: "hutan_sungai_wain", name: "Hutan Lindung S. Wain & IKN (Balikpapan, Kaltim)", forest_type: "Penyangga IKN Nusantara", province: "Kalimantan Timur", region: "Kalimantan", lat: -1.12, lon: 116.85, area_ha: 10025, risk: "Waspada", n_hotspots: 0 },

  // Jawa (6 Kawasan Hutan & Sabana)
  { id: "hutan_bromo", name: "Sabana Bromo - TN Bromo Tengger Semeru (Jatim)", forest_type: "Sabana Kaldera Alpin", province: "Jawa Timur", region: "Jawa", lat: -7.94, lon: 112.95, area_ha: 50276, risk: "Sangat Rawan", n_hotspots: 6 },
  { id: "hutan_baluran", name: "Sabana Bekol - TN Baluran (Situbondo, Jatim)", forest_type: "Sabana Tropis Alami", province: "Jawa Timur", region: "Jawa", lat: -7.83, lon: 114.38, area_ha: 25000, risk: "Sangat Rawan", n_hotspots: 6 },
  { id: "hutan_gunung_lawu", name: "Hutan Lindung Gunung Lawu (Karanganyar, Jateng)", forest_type: "Hutan Lereng Kering", province: "Jawa Tengah", region: "Jawa", lat: -7.63, lon: 111.19, area_ha: 15000, risk: "Rawan", n_hotspots: 12 },
  { id: "hutan_merbabu", name: "Sabana TN Gunung Merbabu (Boyolali, Jateng)", forest_type: "Sabana Alpin Puncak", province: "Jawa Tengah", region: "Jawa", lat: -7.45, lon: 110.43, area_ha: 5725, risk: "Rawan", n_hotspots: 3 },
  { id: "hutan_ciremai", name: "TN Gunung Ciremai (Kuningan, Jabar)", forest_type: "Hutan Lereng Kering", province: "Jawa Barat", region: "Jawa", lat: -6.89, lon: 108.40, area_ha: 15500, risk: "Waspada", n_hotspots: 7 },
  { id: "hutan_alas_purwo", name: "TN Alas Purwo (Banyuwangi, Jatim)", forest_type: "Hutan Musim Blambangan", province: "Jawa Timur", region: "Jawa", lat: -8.65, lon: 114.45, area_ha: 43420, risk: "Waspada", n_hotspots: 1 },

  // Bali & Nusa Tenggara (5 Kawasan Hutan & Sabana)
  { id: "hutan_komodo", name: "Sabana Padar & Loh Liang - TN Komodo (NTT)", forest_type: "Sabana Tropis Kering", province: "Nusa Tenggara Timur", region: "Bali & Nusa Tenggara", lat: -8.55, lon: 119.55, area_ha: 173300, risk: "Rawan", n_hotspots: 8 },
  { id: "hutan_manupeu_sumba", name: "Savana TN Manupeu Tanah Daru (Sumba, NTT)", forest_type: "Savana Tropis Luas", province: "Nusa Tenggara Timur", region: "Bali & Nusa Tenggara", lat: -9.75, lon: 119.85, area_ha: 87984, risk: "Sangat Rawan", n_hotspots: 1 },
  { id: "hutan_tambora", name: "Sabana Doro Ncanga - TN Tambora (Bima, NTB)", forest_type: "Sabana Lereng Kaldera", province: "Nusa Tenggara Barat", region: "Bali & Nusa Tenggara", lat: -8.25, lon: 118.00, area_ha: 71645, risk: "Rawan", n_hotspots: 2 },
  { id: "hutan_rinjani", name: "Hutan Sembalun - TN Gunung Rinjani (NTB)", forest_type: "Savana Lembah Sembalun", province: "Nusa Tenggara Barat", region: "Bali & Nusa Tenggara", lat: -8.42, lon: 116.45, area_ha: 41330, risk: "Rawan", n_hotspots: 2 },
  { id: "hutan_bali_barat", name: "TN Bali Barat & Prapat Agung (Buleleng, Bali)", forest_type: "Hutan Musim Monsoonal", province: "Bali", region: "Bali & Nusa Tenggara", lat: -8.15, lon: 114.48, area_ha: 19002, risk: "Waspada", n_hotspots: 7 },

  // Sulawesi (4 Kawasan Hutan & Sabana)
  { id: "hutan_rawa_aopa", name: "Sabana Rawa TN Rawa Aopa Watumohai (Sultra)", forest_type: "Sabana Lahan Basah", province: "Sulawesi Tenggara", region: "Sulawesi", lat: -4.45, lon: 121.95, area_ha: 105000, risk: "Rawan", n_hotspots: 0 },
  { id: "hutan_lore_lindu", name: "TN Lore Lindu (Poso & Sigi, Sulteng)", forest_type: "Hutan Pegunungan", province: "Sulawesi Tengah", region: "Sulawesi", lat: -1.35, lon: 120.15, area_ha: 217991, risk: "Waspada", n_hotspots: 19 },
  { id: "hutan_bogani", name: "TN Bogani Nani Wartabone (Gorontalo/Sulut)", forest_type: "Hutan Tropis Konservasi", province: "Gorontalo", region: "Sulawesi", lat: 0.55, lon: 123.65, area_ha: 287115, risk: "Waspada", n_hotspots: 60 },
  { id: "hutan_maros", name: "Hutan Karst Bantimurung (Maros, Sulsel)", forest_type: "Hutan Karst Perbukitan", province: "Sulawesi Selatan", region: "Sulawesi", lat: -4.95, lon: 119.75, area_ha: 43750, risk: "Waspada", n_hotspots: 1 },

  // Maluku & Papua (3 Kawasan Hutan & Sabana)
  { id: "hutan_wasur", name: "Sabana Merauke - TN Wasur (Papua Selatan)", forest_type: "Sabana Kayu Putih Tropis", province: "Papua Selatan", region: "Maluku & Papua", lat: -8.55, lon: 140.65, area_ha: 413810, risk: "Sangat Rawan", n_hotspots: 60 },
  { id: "hutan_mappi_asmat", name: "Lahan Gambut Mappi & Asmat (Papua Selatan)", forest_type: "Rawa Gambut Papua", province: "Papua Selatan", region: "Maluku & Papua", lat: -6.85, lon: 139.45, area_ha: 650000, risk: "Rawan", n_hotspots: 60 },
  { id: "hutan_bintuni", name: "Hutan Pesisir Teluk Bintuni (Papua Barat)", forest_type: "Hutan Rawa Dataran Rendah", province: "Papua Barat", region: "Maluku & Papua", lat: -2.15, lon: 133.55, area_ha: 260000, risk: "Waspada", n_hotspots: 3 }
];

// State filter & selection combobox
let currentComboboxFilter = "all";

function populateVolcanoDropdown(features) {
  const sel = document.getElementById("eventSelect");
  const comboList = document.getElementById("eventComboboxList");
  if (!sel) return;

  sel.innerHTML = "";
  if (comboList) comboList.innerHTML = "";
  const hazard = currentHazard || "volcano";

  if (hazard === "volcano") {
    // Kelompokkan 70 gunung api berdasarkan pulau/kawasan besar
    const regionGroups = {
      "Sumatera": [],
      "Jawa": [],
      "Bali & Nusa Tenggara": [],
      "Sulawesi": [],
      "Maluku & Papua": []
    };

    (features || allVolcanoesData || []).forEach(f => {
      const p = f.properties;
      const reg = p.region || "Lainnya";
      if (!regionGroups[reg]) regionGroups[reg] = [];
      regionGroups[reg].push(f);
    });

    for (const [regName, vList] of Object.entries(regionGroups)) {
      if (vList.length === 0) continue;

      // Native select optgroup (untuk fallback backward compatibility)
      const optGroup = document.createElement("optgroup");
      optGroup.label = `Gunung Api ${regName} (${vList.length})`;

      // Header grup di combobox list
      if (comboList) {
        const groupHdr = document.createElement("div");
        groupHdr.className = "combobox-group-header";
        groupHdr.dataset.region = regName;
        groupHdr.textContent = `Gunung Api ${regName} (${vList.length})`;
        comboList.appendChild(groupHdr);
      }

      vList.forEach(f => {
        const p = f.properties;
        const eventId = p.event_id || p.id;
        const lvlNum = p.level || 1;
        const lvlName = p.level_name ? p.level_name.split(' ')[0] + ' ' + (p.level_name.split(' ')[1] || '') : `Level ${lvlNum}`;

        // Fallback option
        const opt = document.createElement("option");
        opt.value = eventId;
        opt.textContent = `[${lvlName}] ${p.name} (${p.province}) - ${p.elevation_m}m`;
        optGroup.appendChild(opt);

        // Custom combobox item card
        if (comboList) {
          const item = document.createElement("div");
          item.className = "combobox-item";
          item.dataset.id = eventId;
          item.dataset.region = regName;
          item.dataset.level = lvlNum;
          item.dataset.name = p.name.toLowerCase();
          item.dataset.province = (p.province || "").toLowerCase();

          const badgeClass = `item-badge-lvl${lvlNum}`;
          item.innerHTML = `
            <div class="combobox-item-top">
              <span class="combobox-item-name">${p.name}</span>
              <span class="item-lvl-badge ${badgeClass}">${lvlName}</span>
            </div>
            <div class="combobox-item-sub">${p.province} &bull; ${p.elevation_m} mdpl &bull; KRB ${p.radius_bahaya_km} km</div>
          `;

          item.addEventListener("click", () => {
            selectComboboxItem(eventId);
          });
          comboList.appendChild(item);
        }
      });
      sel.appendChild(optGroup);
    }

    if (!sel.value) sel.value = "anak_krakatau_2026_09";
  } else {
    // Kelompokkan 36 Kawasan Hutan & Konservasi berdasarkan 6 Pulau Besar
    const fireGroups = {
      "Sumatera": [],
      "Kalimantan": [],
      "Jawa": [],
      "Bali & Nusa Tenggara": [],
      "Sulawesi": [],
      "Maluku & Papua": []
    };

    NATIONAL_KARHUTLA_EVENTS.forEach(k => {
      const reg = k.region || "Lainnya";
      if (!fireGroups[reg]) fireGroups[reg] = [];
      fireGroups[reg].push(k);
    });

    for (const [regName, kList] of Object.entries(fireGroups)) {
      if (kList.length === 0) continue;

      const optGroup = document.createElement("optgroup");
      optGroup.label = `Kawasan Hutan ${regName} (${kList.length})`;

      if (comboList) {
        const groupHdr = document.createElement("div");
        groupHdr.className = "combobox-group-header";
        groupHdr.dataset.region = regName;
        groupHdr.textContent = `🌲 Kawasan Hutan & Konservasi ${regName} (${kList.length})`;
        comboList.appendChild(groupHdr);
      }

      kList.forEach(k => {
        const opt = document.createElement("option");
        opt.value = k.id;
        opt.textContent = `[${k.forest_type}] ${k.name}`;
        optGroup.appendChild(opt);

        if (comboList) {
          const item = document.createElement("div");
          item.className = "combobox-item";
          item.dataset.id = k.id;
          item.dataset.region = regName;
          item.dataset.level = k.risk === "Sangat Rawan" ? 4 : (k.risk === "Rawan" ? 3 : 2);
          item.dataset.name = k.name.toLowerCase();
          item.dataset.province = (k.province || "").toLowerCase();

          const riskBadgeClass = k.risk === "Sangat Rawan" ? "item-badge-lvl4" : (k.risk === "Rawan" ? "item-badge-lvl3" : "item-badge-fire");

          item.innerHTML = `
            <div class="combobox-item-top">
              <span class="combobox-item-name">${k.name}</span>
              <span class="item-lvl-badge ${riskBadgeClass}">${k.risk || 'Rawan'}</span>
            </div>
            <div class="combobox-item-sub">${k.province} &bull; ${k.forest_type} &bull; ${k.n_hotspots} Titik Api</div>
          `;

          item.addEventListener("click", () => {
            selectComboboxItem(k.id);
          });
          comboList.appendChild(item);
        }
      });
      sel.appendChild(optGroup);
    }

    if (!sel.value) sel.value = "hutan_sebangau";
  }

  // Sinkronisasi teks trigger & tombol switcher
  syncComboboxTriggerUI(sel.value);
  syncHazardSwitcherUI();
  filterComboboxItems();
}

function selectComboboxItem(eventId) {
  const sel = document.getElementById("eventSelect");
  if (sel) {
    sel.value = eventId;
    sel.dispatchEvent(new Event("change"));
  }
  syncComboboxTriggerUI(eventId);
  closeCombobox();
}

function syncHazardSwitcherUI() {
  const hazard = currentHazard || (document.getElementById("hazardSelect") ? document.getElementById("hazardSelect").value : "volcano");
  const btnVolcano = document.getElementById("btnHazardVolcano");
  const btnFire = document.getElementById("btnHazardFire");
  if (btnVolcano && btnFire) {
    btnVolcano.classList.toggle("active", hazard === "volcano");
    btnFire.classList.toggle("active", hazard === "fire");
  }

  // Sinkronkan tab mode di dalam popover combobox
  const tabVolc = document.getElementById("comboTabVolcano");
  const tabFire = document.getElementById("comboTabFire");
  if (tabVolc && tabFire) {
    tabVolc.classList.toggle("active", hazard === "volcano");
    tabFire.classList.toggle("active", hazard === "fire");
  }

  const iconEl = document.getElementById("comboboxHazardIcon");
  if (iconEl) {
    iconEl.textContent = hazard === "volcano" ? "🌋" : "🌲";
  }

  const chipAlert = document.getElementById("chipAlert");
  if (chipAlert) {
    chipAlert.textContent = hazard === "volcano" ? "Siaga/Awas" : "Sangat Rawan";
  }
}

function syncComboboxTriggerUI(selectedId) {
  const titleEl = document.getElementById("comboboxSelectedTitle");
  const iconEl = document.getElementById("comboboxHazardIcon");
  const hazard = currentHazard || "volcano";

  if (iconEl) iconEl.textContent = hazard === "volcano" ? "🌋" : "🌲";

  if (!selectedId) {
    const sel = document.getElementById("eventSelect");
    selectedId = sel ? sel.value : null;
  }

  if (hazard === "volcano") {
    const feat = (allVolcanoesData || []).find(f => (f.properties.event_id === selectedId || f.properties.id === selectedId));
    if (feat && titleEl) {
      const p = feat.properties;
      const lvl = p.level_name ? p.level_name.split(' ')[0] + ' ' + (p.level_name.split(' ')[1] || '') : `Level ${p.level}`;
      titleEl.textContent = `[${lvl}] ${p.name} (${p.province})`;
    } else if (titleEl) {
      titleEl.textContent = "Pilih Gunung Api...";
    }
  } else {
    const fire = NATIONAL_KARHUTLA_EVENTS.find(k => k.id === selectedId);
    if (fire && titleEl) {
      titleEl.textContent = `🌲 ${fire.name}`;
    } else if (titleEl) {
      titleEl.textContent = "Pilih Kawasan Hutan...";
    }
  }

  // Tandai item terpilih di list
  document.querySelectorAll("#eventComboboxList .combobox-item").forEach(el => {
    el.classList.toggle("selected", el.dataset.id === selectedId);
  });
}

function closeCombobox() {
  const popover = document.getElementById("eventComboboxPopover");
  const trigger = document.getElementById("eventComboboxTrigger");
  if (popover) popover.classList.remove("open");
  if (trigger) trigger.classList.remove("open");
}

function openCombobox() {
  const popover = document.getElementById("eventComboboxPopover");
  const trigger = document.getElementById("eventComboboxTrigger");
  if (popover) popover.classList.add("open");
  if (trigger) trigger.classList.add("open");
  const searchInput = document.getElementById("eventSearchInput");
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 50);
  }
}

function toggleCombobox() {
  const popover = document.getElementById("eventComboboxPopover");
  if (popover && popover.classList.contains("open")) {
    closeCombobox();
  } else {
    openCombobox();
  }
}

function filterComboboxItems() {
  const searchInput = document.getElementById("eventSearchInput");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const clearBtn = document.getElementById("btnClearSearch");
  if (clearBtn) clearBtn.style.display = query ? "block" : "none";

  const items = document.querySelectorAll("#eventComboboxList .combobox-item");
  const headers = document.querySelectorAll("#eventComboboxList .combobox-group-header");
  let visibleCount = 0;

  items.forEach(item => {
    const name = item.dataset.name || "";
    const prov = item.dataset.province || "";
    const reg = item.dataset.region || "";
    const lvl = parseInt(item.dataset.level || "1");

    let matchesSearch = true;
    if (query) {
      matchesSearch = name.includes(query) || prov.includes(query) || reg.toLowerCase().includes(query);
    }

    let matchesFilter = true;
    if (currentComboboxFilter === "alert") {
      matchesFilter = lvl >= 3;
    } else if (currentComboboxFilter !== "all") {
      matchesFilter = (reg === currentComboboxFilter);
    }

    const isVisible = matchesSearch && matchesFilter;
    item.style.display = isVisible ? "flex" : "none";
    if (isVisible) visibleCount++;
  });

  // Tampilkan/sembunyikan header grup jika tidak ada item yang cocok
  headers.forEach(hdr => {
    const reg = hdr.dataset.region;
    const hasVisibleChild = Array.from(items).some(it => it.dataset.region === reg && it.style.display !== "none");
    hdr.style.display = hasVisibleChild ? "block" : "none";
  });

  // Tampilkan pesan jika tidak ada hasil yang cocok
  const comboList = document.getElementById("eventComboboxList");
  let emptyMsg = document.getElementById("comboboxEmptyMsg");
  if (visibleCount === 0) {
    if (!emptyMsg && comboList) {
      emptyMsg = document.createElement("div");
      emptyMsg.id = "comboboxEmptyMsg";
      emptyMsg.style.cssText = "padding: 16px 12px; text-align: center; color: #94a3b8; font-size: 11.5px; font-style: italic;";
      comboList.appendChild(emptyMsg);
    }
    if (emptyMsg) {
      emptyMsg.textContent = query 
        ? `Tidak ditemukan lokasi yang cocok dengan "${query}".` 
        : "Tidak ada lokasi untuk filter pulau/status ini.";
      emptyMsg.style.display = "block";
    }
  } else if (emptyMsg) {
    emptyMsg.style.display = "none";
  }
}

function renderVolcanoMarkers(features) {
  if (volcanoesLayer) {
    map.removeLayer(volcanoesLayer);
  }

  volcanoesLayer = L.geoJSON({ type: "FeatureCollection", features: features }, {
    pointToLayer: (feature, latlng) => {
      const p = feature.properties;
      return L.marker(latlng, {
        icon: createVolcanoSvgIcon(p.color, p.level),
        title: `${p.name} - ${p.level_name}`
      });
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const coords = feature.geometry.coordinates;

      layer.bindTooltip(`<strong>${p.name}</strong><br><span style="color:${p.color}">${p.level_name}</span>`, {
        direction: "top",
        offset: [0, -10],
        className: "volcano-tooltip"
      });

      const popupHtml = `
        <div class="popup-box">
          <div class="popup-volcano-title">
            <span><svg class="icon-inline" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="12,2 4,20 20,20"/></svg> ${p.name}</span>
            <span class="badge-level lvl-${p.level}">${p.level_name.replace("Level ", "")}</span>
          </div>
          <div style="color:#9db0a4;font-size:11px;margin-bottom:6px;">
            Provinsi: <strong>${p.province}</strong> &bull; Elevasi: <strong>${p.elevation_m} mdpl</strong>
          </div>
          <div style="background:#131815;border:1px solid #2e3b33;border-radius:4px;padding:6px;font-size:11px;margin-bottom:8px;">
            <div>[KRB] <strong>Rekomendasi KRB:</strong> Radius bahaya <strong>${p.radius_bahaya_km} km</strong></div>
            <div style="margin-top:3px;color:#cbd5e1;"><small>VONA Terkini: ${p.last_vona || '-'}</small></div>
          </div>
          <button class="popup-action-btn" onclick="selectAndSimulateVolcano('${p.event_id || p.id}', ${coords[1]}, ${coords[0]}, ${p.radius_bahaya_km})">
            Simulasikan Sebaran Abu Vulkanik
          </button>
        </div>
      `;

      layer.bindPopup(popupHtml, { maxWidth: 280 });

      layer.on("click", () => {
        highlightVolcanoOnMap(coords[1], coords[0], p.radius_bahaya_km);
      });
    }
  });

  if (document.getElementById("layerToggleVolcanoes").checked) {
    volcanoesLayer.addTo(map);
  }
}

// Sorot Gunung & Buat Lingkaran KRB Bahaya
function highlightVolcanoOnMap(lat, lng, radiusKm) {
  if (currentKrbCircle) {
    map.removeLayer(currentKrbCircle);
  }

  currentKrbCircle = L.circle([lat, lng], {
    radius: (radiusKm || 5.0) * 1000,
    color: "#ef4444",
    weight: 1.5,
    dashArray: "4, 4",
    fillColor: "#ef4444",
    fillOpacity: 0.12
  }).addTo(map);

  currentKrbCircle.bindTooltip(`Zona Rekomendasi Bahaya PVMBG (${radiusKm} km)`, { sticky: true });
}

// Tombol dari Popup Peta Langsung
window.selectAndSimulateVolcano = function(eventId, lat, lng, radiusKm) {
  // 1. Pilih jenis bahaya gunung
  const hazardSel = document.getElementById("hazardSelect");
  hazardSel.value = "volcano";
  currentHazard = "volcano";
  onHazardChanged();

  // 2. Pilih event pada dropdown
  const eventSel = document.getElementById("eventSelect");
  eventSel.value = eventId;

  // 3. Zoom ke gunung
  if (lat && lng) {
    map.flyTo([lat, lng], 9, { duration: 1.0 });
    highlightVolcanoOnMap(lat, lng, radiusKm);
  }

  // 4. Buka drawer jika tertutup
  openDrawer();

  // 5. Jalankan simulasi
  runSimulation();
};

// =============================================================================
// 3b. Lapisan Kawasan Hutan & Konservasi Karhutla Nasional (36 Lokasi Hutan)
// =============================================================================
function createForestSvgIcon(forest) {
  const nHotspots = (typeof forest === "object" && forest !== null)
    ? (forest.n_hotspots ?? 0)
    : (typeof forest === "number" ? forest : 0);

  // Status visual berbasis pengamatan riil satelit FIRMS hari ini:
  // 1. Kebakaran aktif masif (>= 10 titik api) -> Merah menyala + Pulse ring cepat
  // 2. Api kecil / sporadis (1 - 9 titik api)  -> Oranye waspada + Pulse ring lembut
  // 3. Udara bersih / aman (0 titik api)        -> Hijau tenang, TANPA pulse ring
  let borderCol = "#10b981";
  let bgCol = "#112217";
  let shadowCol = "rgba(16, 185, 129, 0.4)";
  let pulseRing = "";

  if (nHotspots >= 10) {
    borderCol = "#ef4444";
    bgCol = "#2a1515";
    shadowCol = "rgba(239, 68, 68, 0.7)";
    pulseRing = '<span class="volcano-pulse-ring" style="border-color:#ef4444;"></span>';
  } else if (nHotspots > 0) {
    borderCol = "#f59e0b";
    bgCol = "#261c12";
    shadowCol = "rgba(245, 158, 11, 0.6)";
    pulseRing = '<span class="volcano-pulse-ring" style="border-color:#f59e0b;animation-duration:2.5s;"></span>';
  }

  return L.divIcon({
    className: "forest-div-icon",
    html: `
      <div class="volcano-marker-pin">
        ${pulseRing}
        <div style="background:${bgCol};border:2px solid ${borderCol};border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px ${shadowCol};transition:all 0.3s ease;">
          <span style="font-size:13px;line-height:1;">🌲</span>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14]
  });
}

function loadNationalForests() {
  fetch(`${API_BASE}/layers/forests-national`)
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data) && data.length > 0) {
        data.forEach(srvF => {
          const local = NATIONAL_KARHUTLA_EVENTS.find(k => k.id === srvF.id);
          if (local) {
            local.n_hotspots = srvF.n_hotspots ?? local.n_hotspots;
          }
        });
      }
      renderForestMarkers(NATIONAL_KARHUTLA_EVENTS);
    })
    .catch(err => {
      console.warn("Gagal fetch /layers/forests-national, fallback ke data lokal:", err);
      renderForestMarkers(NATIONAL_KARHUTLA_EVENTS);
    });
}

function renderForestMarkers(forests) {
  if (forestsLayer) {
    map.removeLayer(forestsLayer);
  }

  const markers = [];
  forests.forEach(f => {
    const marker = L.marker([f.lat, f.lon], {
      icon: createForestSvgIcon(f),
      title: `${f.name} - ${f.forest_type}`
    });

    const statusBadge = f.n_hotspots >= 10
      ? `<span style="color:#ef4444;font-weight:600;">🔥 ${f.n_hotspots} Titik Api Aktif (Karhutla)</span>`
      : (f.n_hotspots > 0
        ? `<span style="color:#f59e0b;font-weight:600;">⚠️ ${f.n_hotspots} Titik Api Kecil</span>`
        : `<span style="color:#10b981;font-weight:600;">✅ Aman • Udara Bersih (0 Titik Api)</span>`);

    marker.bindTooltip(`<strong>🌲 ${f.name}</strong><br>${statusBadge}<br><span style="color:#94a3b8;font-size:10px;">${f.forest_type} &bull; Kerentanan: ${f.risk}</span>`, {
      direction: "top",
      offset: [0, -10],
      className: "volcano-tooltip"
    });

    const hotspotBadge = f.n_hotspots === 0
      ? '<span style="color:#10b981;font-weight:600;">0 titik aktif (Aman &bull; Udara Bersih)</span>'
      : (f.n_hotspots < 10
        ? `<span style="color:#f59e0b;font-weight:600;">${f.n_hotspots} titik kecil (FRP Rendah &bull; PM2.5 Aman)</span>`
        : `<span style="color:#ef4444;font-weight:600;">${f.n_hotspots} titik aktif (Karhutla Berbahaya)</span>`);

    const popupHtml = `
      <div class="popup-box">
        <div class="popup-volcano-title">
          <span>🌲 ${f.name}</span>
          <span class="badge-level lvl-${f.n_hotspots >= 10 ? 4 : (f.n_hotspots > 0 ? 3 : 1)}">
            ${f.n_hotspots >= 10 ? 'Karhutla Aktif' : (f.n_hotspots > 0 ? 'Titik Api Kecil' : 'Aman')}
          </span>
        </div>
        <div style="color:#9db0a4;font-size:11px;margin-bottom:6px;">
          Provinsi: <strong>${f.province}</strong> &bull; Ekosistem: <strong>${f.forest_type}</strong>
        </div>
        <div style="background:#131815;border:1px solid #2e3b33;border-radius:4px;padding:6px;font-size:11px;margin-bottom:8px;">
          <div>[FIRMS] <strong>Deteksi Satelit Hari Ini:</strong> ${hotspotBadge}</div>
          <div style="margin-top:2px;color:#94a3b8;"><small>Kerentanan Ekosistem Historis: <span style="color:${f.risk === 'Sangat Rawan' ? '#f87171' : '#fbbf24'};">${f.risk}</span></small></div>
          <div style="margin-top:2px;color:#cbd5e1;"><small>Estimasi Luas Kawasan: ${Number(f.area_ha).toLocaleString()} ha</small></div>
        </div>
        <button class="popup-action-btn" onclick="selectAndSimulateForest('${f.id}', ${f.lat}, ${f.lon}, ${f.n_hotspots})">
          ${f.n_hotspots < 10 ? 'Uji Skenario Kebakaran (Eksperimen)' : 'Simulasikan Sebaran Asap PM2.5'}
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml, { maxWidth: 280 });
    markers.push(marker);
  });

  forestsLayer = L.layerGroup(markers);

  const toggle = document.getElementById("layerToggleForests");
  if (!toggle || toggle.checked) {
    forestsLayer.addTo(map);
  }
}

// =============================================================================
// 3b. Tombol dari Popup Hutan & Navigasi
// =============================================================================
window.selectAndSimulateForest = function(forestId, lat, lon, nHotspots) {
  // 1. Pilih jenis bahaya karhutla
  const hazardSel = document.getElementById("hazardSelect");
  hazardSel.value = "fire";
  currentHazard = "fire";
  onHazardChanged();

  // 2. Jika titik api < 10 (nihil atau api kecil yang tidak menghasilkan asap bahaya di mode auto),
  // otomatis aktifkan mode eksperimen agar pengguna melihat skenario kepulan asap hipotetis
  if (nHotspots < 10) {
    const expRadio = document.querySelector('input[name="simMode"][value="experiment"]');
    if (expRadio) {
      expRadio.checked = true;
      if (typeof onSimModeChanged === "function") onSimModeChanged();
    }
  } else {
    const autoRadio = document.querySelector('input[name="simMode"][value="auto"]');
    if (autoRadio) {
      autoRadio.checked = true;
      if (typeof onSimModeChanged === "function") onSimModeChanged();
    }
  }

  // 3. Pilih event pada dropdown
  const eventSel = document.getElementById("eventSelect");
  eventSel.value = forestId;
  onEventSelectChanged({ target: { value: forestId } });

  // 4. Zoom ke kawasan hutan
  if (lat && lon) {
    map.flyTo([lat, lon], 9, { duration: 1.0 });
  }

  // 5. Buka drawer dan jalankan simulasi
  openDrawer();
  runSimulation();
};

function onHazardChanged() {
  const hazard = document.getElementById("hazardSelect").value;
  currentHazard = hazard;
  const eventSel = document.getElementById("eventSelect");
  const volcControls = document.getElementById("volcanoExpControls");
  const fireControls = document.getElementById("fireExpControls");
  const labelEl = document.getElementById("eventSelectLabel");
  const searchInput = document.getElementById("eventSearchInput");

  // Perbarui dropdown sesuai bahaya yang aktif
  populateVolcanoDropdown(allVolcanoesData);

  // Perbarui palet warna & label legenda sebaran langsung
  if (typeof updatePlumeLegend === "function") {
    updatePlumeLegend(hazard);
  }

  if (hazard === "fire") {
    if (labelEl) labelEl.textContent = "Pilih Kawasan Hutan & Konservasi (36 Hutan):";
    if (searchInput) searchInput.placeholder = "Cari taman nasional / hutan (misal: Sebangau, Tesso Nilo, Bromo)...";
    if (volcControls) volcControls.classList.add("hidden");
    if (fireControls) fireControls.classList.remove("hidden");
    if (currentKrbCircle) {
      map.removeLayer(currentKrbCircle);
      currentKrbCircle = null;
    }
    const currentFireId = (eventSel && eventSel.value && (eventSel.value.startsWith("hutan_") || eventSel.value.startsWith("karhutla_") || eventSel.value === "live_kalimantan")) ? eventSel.value : "hutan_sebangau";
    const fireObj = NATIONAL_KARHUTLA_EVENTS.find(k => k.id === currentFireId);
    if (fireObj) {
      map.flyTo([fireObj.lat, fireObj.lon], 9, { duration: 1.2 });
    } else {
      map.flyTo([-2.5, 118.0], 5, { duration: 1.2 });
    }
  } else {
    if (labelEl) labelEl.textContent = "Pilih Gunung Api Aktif (70 Lokasi PVMBG):";
    if (searchInput) searchInput.placeholder = "Cari gunung api (misal: Merapi, Lewotobi, Sinabung)...";
    if (volcControls) volcControls.classList.remove("hidden");
    if (fireControls) fireControls.classList.add("hidden");
    zoomToCurrentEvent(eventSel ? eventSel.value : "anak_krakatau_2026_09", "volcano");
  }
  syncHazardSwitcherUI();
  syncComboboxTriggerUI(eventSel ? eventSel.value : null);
}

function onEventSelectChanged(e) {
  const val = e.target.value;
  const isFire = val === "live_kalimantan" || val.startsWith("karhutla_") || val.startsWith("hutan_");
  const hazardSel = document.getElementById("hazardSelect");

  if (isFire) {
    if (hazardSel.value !== "fire") {
      hazardSel.value = "fire";
      currentHazard = "fire";
      if (typeof updatePlumeLegend === "function") updatePlumeLegend("fire");
    }
    const fireObj = NATIONAL_KARHUTLA_EVENTS.find(k => k.id === val);
    if (fireObj) {
      map.flyTo([fireObj.lat, fireObj.lon], 9, { duration: 1.0 });
    }
  } else {
    if (hazardSel.value !== "volcano") {
      hazardSel.value = "volcano";
      currentHazard = "volcano";
      if (typeof updatePlumeLegend === "function") updatePlumeLegend("volcano");
    }
    const f = (allVolcanoesData || []).find(feat => (feat.properties.event_id === val || feat.properties.id === val));
    if (f && f.geometry && f.geometry.coordinates) {
      const c = f.geometry.coordinates;
      map.flyTo([c[1], c[0]], 9, { duration: 1.0 });
      highlightVolcanoOnMap(c[1], c[0], f.properties.radius_bahaya_km || 5.0);
    } else {
      zoomToCurrentEvent(val, "volcano");
    }
  }
  syncHazardSwitcherUI();
  syncComboboxTriggerUI(val);
}

// =============================================================================
// 4. Lapisan Titik Api Kebakaran (NASA FIRMS Hotspots Nasional - Persisten)
// =============================================================================
function loadHotspots() {
  if (hotspotsLayer) {
    map.removeLayer(hotspotsLayer);
  }

  fetch(`${API_BASE}/layers/hotspots?event_id=national`)
    .then(r => r.json())
    .then(geo => {
      hotspotsLayer = L.geoJSON(geo, {
        pointToLayer: (feature, latlng) => {
          const frp = feature.properties.frp || 10;
          const radius = Math.min(Math.max(frp / 25, 3.5), 9);

          return L.circleMarker(latlng, {
            radius: radius,
            fillColor: "#ef4444",
            color: "#fca5a5",
            weight: 1,
            opacity: 0.9,
            fillOpacity: 0.75
          });
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          let confLabel = "Nominal (50-84%)";
          const rawConf = String(p.confidence || "").toLowerCase();
          if (rawConf === "h" || rawConf === "high" || Number(rawConf) >= 80) {
            confLabel = "Tinggi (85-100%)";
          } else if (rawConf === "l" || rawConf === "low" || (Number(rawConf) > 0 && Number(rawConf) < 50)) {
            confLabel = "Rendah (<50%)";
          } else if (Number(rawConf) >= 50) {
            confLabel = `${rawConf}% (Nominal)`;
          }

          layer.bindTooltip(`
            <div style="font-family:sans-serif;font-size:11px;line-height:1.4;">
              <strong style="color:#f87171;">Titik Api Aktif: ${p.frp} MW</strong><br>
              <span style="color:#fbbf24;">Keyakinan Satelit: ${confLabel}</span><br>
              <small style="color:#94a3b8;">Satelit VIIRS NRT &bull; ${p.acq_date || 'Terkini'}</small>
            </div>
          `, { direction: "top", className: "volcano-tooltip" });
        }
      });

      const toggle = document.getElementById("layerToggleHotspots");
      if (!toggle || toggle.checked) {
        hotspotsLayer.addTo(map);
      }
    })
    .catch(() => {});
}

// =============================================================================
// 5. Lapisan Fasilitas Publik (Sekolah, Faskes, Bandara dari OSM)
// =============================================================================
function loadFacilities() {
  if (facilitiesLayer) {
    map.removeLayer(facilitiesLayer);
  }

  fetch(`${API_BASE}/layers/facilities`)
    .then(r => r.json())
    .then(geo => {
      facilitiesLayer = L.geoJSON(geo, {
        pointToLayer: (feature, latlng) => {
          const type = feature.properties.facility_type;
          let color = "#3b82f6"; // Rumah Sakit / Puskesmas
          if (type === "school") color = "#10b981"; // Sekolah
          if (type === "airport") color = "#f59e0b"; // Bandara

          return L.circleMarker(latlng, {
            radius: 4.5,
            fillColor: color,
            color: "#ffffff",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.85
          });
        },
        onEachFeature: (feature, layer) => {
          layer.on("click", () => {
            selectFacility(feature.properties.facility_id);
          });
          layer.bindTooltip(`${feature.properties.name} (${feature.properties.facility_type})`, {
            direction: "top"
          });
        }
      });

      if (document.getElementById("layerToggleFacilities").checked) {
        facilitiesLayer.addTo(map);
      }
    })
    .catch(err => console.error("Gagal memuat facilities:", err));
}

// Kartu Keputusan Fasilitas Publik
function selectFacility(facilityId) {
  const cardBox = document.getElementById("decisionCardContent");
  if (!currentRunId) {
    cardBox.innerHTML = "<div class='tile-sub-warn'>Jalankan simulasi terlebih dahulu untuk mengevaluasi risiko fasilitas ini.</div>";
    openDrawer();
    return;
  }

  cardBox.innerHTML = "<div class='note-sub'>Menghitung peluang paparan &amp; estimasi waktu tiba partikel...</div>";
  openDrawer();

  fetch(`${API_BASE}/runs/${currentRunId}/location/${facilityId}`)
    .then(r => r.json())
    .then(data => {
      if (!data.exposure_probability && data.exposure_probability !== 0) {
        cardBox.innerHTML = `<div class='note-sub'>${data.reason || 'Tidak ada data'}</div>`;
        return;
      }

      const probPercent = Math.round(data.exposure_probability * 100);
      const early = data.arrival_time_earliest_h !== null ? `T + ${Math.round(data.arrival_time_earliest_h)} jam` : "Aman (Di luar jejak)";
      const likely = data.arrival_time_most_likely_h !== null ? `T + ${Math.round(data.arrival_time_most_likely_h)} jam` : "-";

      let recText = "[NORMAL] Pantau arah angin dan perkembangan sebaran secara berkala.";
      if (probPercent >= 40) {
        recText = data.facility_type === 'school' 
          ? "<strong>[SIAGA TINGGI] SEGERA ALIHKAN KE PJJ DARING:</strong> Pulangkan siswa atau instruksikan belajar dari rumah sebelum abu tiba. Seluruh warga sekolah wajib memakai <strong>Masker Respirator N95/KN95</strong>."
          : "<strong>[SIAGA DARURAT FASKES]</strong> Siapkan ruang isolasi berfilter HEPA dan cadangan tabung O2 medis untuk lonjakan pasien ISPA/asma.";
      } else if (probPercent >= 15) {
        recText = data.facility_type === 'school'
          ? "<strong>[WASPADA] HENTIKAN AKTIVITAS OUTDOOR:</strong> Dilarang olahraga dan upacara di luar kelas. Siapkan masker N95 di UKS."
          : "<strong>[WASPADA FASKES]</strong> Pastikan stok nebulizer dan masker partikulat siap siaga.";
      }

      cardBox.innerHTML = `
        <div class="decision-card-active">
          <div class="decision-name">[FASILITAS] ${data.name} (${data.facility_type.toUpperCase()})</div>
          <div class="decision-row"><span>Wilayah / Kabupaten:</span><span class="mono">${data.district}</span></div>
          <div class="decision-row"><span>Peluang Terpapar:</span><strong class="mono" style="color:${probPercent > 50 ? '#ef4444' : (probPercent > 20 ? '#f59e0b' : '#10b981')}">${probPercent}%</strong></div>
          <div class="decision-row"><span>Waktu Tiba Tercepat:</span><span class="mono">${early}</span></div>
          <div class="decision-row"><span>Waktu Tiba Paling Mungkin:</span><span class="mono">${likely}</span></div>
          <div style="margin-top:8px;padding:7px;background:rgba(2,132,199,0.12);border-left:3px solid #0284c7;border-radius:4px;">
            <strong style="color:#38bdf8;font-size:11px;">REKOMENDASI OPERASIONAL PENCEGAHAN:</strong>
            <div style="font-size:10.5px;margin-top:3px;line-height:1.4;">${recText}</div>
          </div>
        </div>
      `;
    })
    .catch(err => {
      cardBox.innerHTML = `<div class='note-sub'>Galat fasilitas: ${err}</div>`;
    });
}

// =============================================================================
// 6. Poligon Peluang Tiga Tingkat (P90 Inti, P50 Sedang, P5 Jangkauan Maks)
// =============================================================================
function updateTiersOnMap(hour) {
  if (currentHourlyTiersCache[hour]) {
    renderTiersGeoJSON(currentHourlyTiersCache[hour]);
    return;
  }

  if (!currentRunId) return;

  fetch(`${API_BASE}/runs/${currentRunId}/tiers?t=${hour}`)
    .then(r => r.json())
    .then(geo => {
      currentHourlyTiersCache[hour] = geo;
      renderTiersGeoJSON(geo);
    })
    .catch(err => console.error("Gagal mengambil tiers:", err));
}

/**
 * Palet warna sebaran berdasarkan jenis bahaya (hazard).
 *
 * GUNUNG API (abu vulkanik):
 *   Warna panas merah-jingga-kuning (#7f1d1d -> #dc2626 -> #f59e0b)
 *   Merepresentasikan abu silika panas & partikulat PM2.5 vulkanik.
 *
 * KEBAKARAN (asap karhutla):
 *   Warna asap coklat-kelabu gelap (#3b1f0b -> #78350f -> #92400e)
 *   Merepresentasikan kabut asap organik & jelaga karbon CO/CO2.
 *
 * Setiap tier memiliki opasitas berbeda:
 *   minimum (P90) = opasitas tertinggi (zona sangat berbahaya, paling tebal)
 *   mid     (P50) = opasitas sedang   (zona waspada)
 *   maximum (P05) = opasitas rendah   (zona siaga dini, paling tipis)
 */
const PLUME_PALETTES = {
  volcano: {
    minimum: { fill: "#991b1b", stroke: "#7f1d1d", fillOpacity: 0.60, strokeOpacity: 1.0,  weight: 2.5, dash: null },
    mid:     { fill: "#dc2626", stroke: "#b91c1c", fillOpacity: 0.35, strokeOpacity: 0.85, weight: 1.8, dash: "6, 4" },
    max:     { fill: "#f59e0b", stroke: "#d97706", fillOpacity: 0.15, strokeOpacity: 0.70, weight: 1.0, dash: "3, 3" },
    labels: {
      minimum: "Zona Bahaya Tinggi — Abu Tebal (P90)",
      mid:     "Zona Waspada — Abu Sedang (P50)",
      max:     "Zona Siaga Dini — Debu Halus (P05)"
    },
    shortLabels: {
      minimum: "Abu Tebal (P90)",
      mid:     "Abu Sedang (P50)",
      max:     "Debu Halus (P05)"
    },
    legendTitle: "Sebaran Abu Vulkanik"
  },
  fire: {
    minimum: { fill: "#78350f", stroke: "#451a03", fillOpacity: 0.60, strokeOpacity: 1.0,  weight: 2.5, dash: null },
    mid:     { fill: "#92400e", stroke: "#78350f", fillOpacity: 0.35, strokeOpacity: 0.85, weight: 1.8, dash: "6, 4" },
    max:     { fill: "#a16207", stroke: "#854d0e", fillOpacity: 0.15, strokeOpacity: 0.70, weight: 1.0, dash: "3, 3" },
    labels: {
      minimum: "Zona Bahaya Tinggi — Asap Pekat (P90)",
      mid:     "Zona Waspada — Kabut Asap (P50)",
      max:     "Zona Siaga Dini — Haze Tipis (P05)"
    },
    shortLabels: {
      minimum: "Asap Pekat (P90)",
      mid:     "Kabut Asap (P50)",
      max:     "Haze Tipis (P05)"
    },
    legendTitle: "Sebaran Asap Karhutla"
  }
};

/**
 * Memperbarui tampilan legenda sebaran (judul, swatch warna, dan label intensitas)
 * secara dinamis mengikuti hazard aktif.
 */
function updatePlumeLegend(hazard) {
  const h = hazard || currentHazard || "volcano";
  const palette = PLUME_PALETTES[h] || PLUME_PALETTES.volcano;

  const titleEl = document.getElementById("plumeLegendLabel");
  if (titleEl) {
    titleEl.textContent = palette.legendTitle;
  }

  const s1 = document.getElementById("plumeSwatch1");
  const s2 = document.getElementById("plumeSwatch2");
  const s3 = document.getElementById("plumeSwatch3");
  if (s1) s1.style.background = palette.minimum.fill;
  if (s2) s2.style.background = palette.mid.fill;
  if (s3) s3.style.background = palette.max.fill;

  const l1 = document.getElementById("plumeLabel1");
  const l2 = document.getElementById("plumeLabel2");
  const l3 = document.getElementById("plumeLabel3");
  if (l1) l1.textContent = palette.shortLabels.minimum;
  if (l2) l2.textContent = palette.shortLabels.mid;
  if (l3) l3.textContent = palette.shortLabels.max;
}

function renderTiersGeoJSON(geo) {
  if (currentTiersLayer) {
    map.removeLayer(currentTiersLayer);
  }

  // Notifikasi informatif jika udara bersih / tidak ada poligon asap
  if (!geo || !geo.features || geo.features.length === 0) {
    const progText = document.getElementById("runProgressText");
    if (progText) {
      if (currentHazard === "fire") {
        progText.innerHTML = `<span style="color:#10b981;font-weight:600;">Status Udara Bersih &bull; Aman:</span> Satelit NASA FIRMS mendeteksi titik api minim/nihil pada kawasan ini, emisi PM2.5 di bawah ambang bahaya (&lt; 15.5 &mu;g/m&sup3;). <em>Pilih <strong>Mode 'Coba-coba (Eksperimen)'</strong> di panel kendali jika ingin menguji simulasi skenario kebakaran hipotetis.</em>`;
      }
    }
    return;
  }

  if (!document.getElementById("layerTogglePlume").checked) {
    return;
  }

  // Pilih palet berdasarkan jenis bahaya aktif
  const palette = PLUME_PALETTES[currentHazard] || PLUME_PALETTES.volcano;

  currentTiersLayer = L.geoJSON(geo, {
    smoothFactor: 1.2,
    style: feature => {
      const tier = feature.properties.tier;
      let p;
      if (tier === "minimum") {
        p = palette.minimum;
      } else if (tier === "mid") {
        p = palette.mid;
      } else {
        p = palette.max;
      }
      return {
        color: p.stroke,
        weight: p.weight,
        opacity: p.strokeOpacity,
        fillColor: p.fill,
        fillOpacity: p.fillOpacity,
        dashArray: p.dash
      };
    },
    onEachFeature: (feature, layer) => {
      const props = feature.properties;
      const tierKey = props.tier === "minimum" ? "minimum" : (props.tier === "mid" ? "mid" : "max");
      const tierLabel = palette.labels[tierKey] || props.tier_label || props.tier;
      const hazardNoun = currentHazard === "fire" ? "asap" : "abu";

      layer.bindTooltip(
        `<strong>${tierLabel}</strong><br><small>Klik untuk melihat daftar sekolah &amp; RS di jalur ${hazardNoun}</small>`,
        { sticky: true }
      );
      layer.on("click", () => {
        openDrawer();
        switchDrawerTab("tabPaneSchools");
      });
    }
  }).addTo(map);

  // Perbarui seluruh legenda sebaran
  updatePlumeLegend(currentHazard);
}

// =============================================================================
// 7. Eksekusi Simulasi Ansambel Partikel RK2
// =============================================================================
function runSimulation() {
  const hazard = document.getElementById("hazardSelect").value;
  currentHazard = hazard;
  let eventId = document.getElementById("eventSelect") ? document.getElementById("eventSelect").value : "";
  if (!eventId) {
    const selectedItem = document.querySelector("#eventComboboxList .combobox-item.selected");
    if (selectedItem && selectedItem.dataset.id) {
      eventId = selectedItem.dataset.id;
    } else {
      eventId = hazard === "fire" ? "hutan_sebangau" : "anak_krakatau_2026_09";
    }
    const sel = document.getElementById("eventSelect");
    if (sel) sel.value = eventId;
  }
  const mode = document.querySelector('input[name="simMode"]:checked').value;
  const btn = document.getElementById("btnRunSim");
  const progText = document.getElementById("runProgressText");
  const progBar = document.getElementById("runProgressBar");

  btn.disabled = true;
  progText.textContent = "Menghitung adveksi atmosferik 15 anggota ensemble (RK2)...";
  progBar.style.width = "45%";

  let overrides = null;
  if (mode === "experiment") {
    overrides = {};
    if (hazard === "volcano") {
      overrides.column_height_km = parseFloat(document.getElementById("expColumnHeight").value);
    }
    if (document.getElementById("expWindReverse").checked) {
      overrides.wind = { reverse: true };
    }
    const rainMm = parseFloat(document.getElementById("expRainMm").value);
    if (rainMm > 0) {
      overrides.rain = { intensity_mm_h: rainMm, duration_h: 6, start_h: 4 };
    }
  }

  // 15 anggota ensemble untuk respons instan ~1.5 - 2 detik dengan akurasi P5/P50/P95 penuh
  const isCustom = isCustomPointMode && customPointCoords;
  const payload = {
    hazard: hazard,
    mode: mode,
    source: isCustom ? {
      event_id: `custom_${Math.abs(customPointCoords.lat).toFixed(2)}_${Math.abs(customPointCoords.lng).toFixed(2)}`,
      latitude: customPointCoords.lat,
      longitude: customPointCoords.lng,
      name: `Titik Kustom (${customPointCoords.lat.toFixed(3)}, ${customPointCoords.lng.toFixed(3)})`
    } : { event_id: eventId },
    horizon_hours: 48,
    n_members: 15,
    seed: 42,
    thresholds: { min: 0.9, mid: 0.5, max: 0.05 },
    overrides: overrides
  };

  fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(r => {
      if (!r.ok) {
        return r.json().then(j => { throw new Error(j.detail || "Gagal memproses simulasi"); });
      }
      return r.json();
    })
    .then(data => {
      currentRunId = data.run_id;
      currentHourlyTiersCache = {};
      btn.disabled = false;
      progBar.style.width = "100%";
      progText.textContent = `Selesai: ${data.scenario_label} (${data.n_members} anggota).`;

      // Set timeline slider ke jam 12 sebagai pratinjau awal
      const slider = document.getElementById("timeSlider");
      slider.value = 12;
      document.getElementById("timeDisplay").textContent = `T + 12:00 Jam`;
      if (typeof updateStepButtonsActive === "function") updateStepButtonsActive(12);
      updateTiersOnMap(12);

      // Fokuskan peta ke episentrum kejadian
      zoomToCurrentEvent(eventId, hazard);

      // Muat Kartu Dampak & Lapis 2
      loadImpact();
    })
    .catch(err => {
      btn.disabled = false;
      progBar.style.width = "0%";
      progText.textContent = `Galat: ${err.message}`;
    });
}

function zoomToCurrentEvent(eventId, hazard) {
  if (hazard === "fire") {
    const fireObj = NATIONAL_KARHUTLA_EVENTS.find(k => k.id === eventId);
    if (fireObj) {
      map.flyTo([fireObj.lat, fireObj.lon], 9, { duration: 1.0 });
      return;
    }
    map.flyTo([-2.5, 118.0], 5, { duration: 1.0 });
    return;
  }

  // Cari di allVolcanoesData
  const v = allVolcanoesData.find(f => (f.properties.event_id || f.properties.id) === eventId);
  if (v) {
    const coords = v.geometry.coordinates;
    map.flyTo([coords[1], coords[0]], 9, { duration: 1.0 });
    highlightVolcanoOnMap(coords[1], coords[0], v.properties.radius_bahaya_km);
  }
}

// =============================================================================
// 8. Muat Seluruh Metrik Dampak (P5 - P50 - P95) & Lapis 2
// =============================================================================
function loadImpact() {
  if (!currentRunId) return;

  fetch(`${API_BASE}/runs/${currentRunId}/impact`)
    .then(r => r.json())
    .then(imp => {
      const formatR = r => {
        if (!r) return "- / - / -";
        return `${Math.round(r.min).toLocaleString()} / ${Math.round(r.median).toLocaleString()} / ${Math.round(r.max).toLocaleString()}`;
      };

      document.getElementById("mPopRange").textContent = formatR(imp.population_exposed);
      document.getElementById("mChildRange").textContent = formatR(imp.children_exposed);
      document.getElementById("mElderRange").textContent = formatR(imp.elderly_exposed);
      document.getElementById("mAreaRange").textContent = formatR(imp.area_exposed_km2);

      document.getElementById("mFacRange").textContent = 
        `Sekolah: ${Math.round(imp.schools_exposed.median)} | Faskes: ${Math.round(imp.healthcare_exposed.median)}`;

      const ispuBox = document.getElementById("mIspuStatus");
      if (imp.ispu && !imp.ispu.available) {
        ispuBox.innerHTML = `<span style="color:#f59e0b">DINONAKTIFKAN:</span> ${imp.ispu.reason}`;
      } else {
        ispuBox.textContent = "Kategori aktif: Sedang - Tidak Sehat";
      }

      // Daftar Asumsi Pemodelan
      const listEl = document.getElementById("assumptionsList");
      if (listEl) {
        listEl.innerHTML = "";
        (imp.assumptions_used || []).slice(0, 6).forEach(a => {
          const li = document.createElement("li");
          li.innerHTML = `<strong>${a.parameter}</strong>: [${a.status}] ${a.caveat || a.source || '-'}`;
          listEl.appendChild(li);
        });
      }

      // Muat Lapis 2 & 3
      loadLapis2Features(formatR);
      loadImpactedFacilities();
    })
    .catch(err => console.error("Gagal muat dampak:", err));
}

// =============================================================================
// =============================================================================
// 8B. Protokol Aksi Sekolah (PJJ Daring) & Evakuasi Medis Rumah Sakit
// =============================================================================
let cachedImpactedFacilities = null;
let currentEvacRouteLayer = null;

function drawEvacuationRoute(fromLat, fromLon, toLat, toLon, fromName, toName, distKm) {
  if (currentEvacRouteLayer) {
    map.removeLayer(currentEvacRouteLayer);
  }
  const latlngs = [[fromLat, fromLon], [toLat, toLon]];
  currentEvacRouteLayer = L.polyline(latlngs, {
    color: "#10b981",
    weight: 3.5,
    opacity: 0.95,
    dashArray: "6, 9"
  }).addTo(map);

  map.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60] });

  const midLat = (fromLat + toLat) / 2.0;
  const midLon = (fromLon + toLon) / 2.0;
  L.popup()
    .setLatLng([midLat, midLon])
    .setContent(`
      <div style="font-size:11px;font-family:sans-serif;color:#f8fafc;padding:3px;">
        <strong style="color:#34d399;">Rute Evakuasi Medis (${distKm} km)</strong><br>
        <span style="color:#94a3b8;">Asal:</span> <strong>${fromName}</strong><br>
        <span style="color:#94a3b8;">Tujuan:</span> <strong style="color:#38bdf8;">${toName}</strong><br>
        <small style="color:#fbbf24;">Prioritas: Pasien sesak napas akut &amp; trauma partikulat.</small>
      </div>
    `)
    .openOn(map);
}

function loadImpactedFacilities() {
  if (!currentRunId) return;

  fetch(`${API_BASE}/runs/${currentRunId}/facilities-impacted?min_prob=0.05`)
    .then(r => r.json())
    .then(data => {
      cachedImpactedFacilities = data;
      renderSchoolsList(data.schools || []);
      renderEvacHospitalsList(data.evacuation_referral_hospitals || []);
    })
    .catch(err => console.error("Gagal muat fasilitas terdampak:", err));
}

function renderSchoolsList(schools) {
  const container = document.getElementById("schoolsListContainer");
  if (!container) return;
  container.innerHTML = "";

  if (schools.length === 0) {
    container.innerHTML = `<div class="empty-state">Tidak ada sekolah di zona risiko paparan &ge; 5%.</div>`;
    return;
  }

  schools.forEach(sch => {
    const card = document.createElement("div");
    card.className = "fac-item-card";
    const early = sch.arrival_time_earliest_h !== null ? `T + ${sch.arrival_time_earliest_h} jam` : "-";
    const probColor = sch.exposure_pct >= 50 ? "#ef4444" : (sch.exposure_pct >= 20 ? "#f59e0b" : "#10b981");

    let evacSnippet = "";
    if (sch.nearest_safe_hospital) {
      const h = sch.nearest_safe_hospital;
      const cleanSchName = (sch.name || '').replace(/'/g, "\\'");
      const cleanHName = (h.name || '').replace(/'/g, "\\'");
      evacSnippet = `
        <div style="margin-top:7px;padding:6px 8px;background:rgba(16,185,129,0.08);border-left:3px solid #10b981;border-radius:4px;font-size:10.5px;">
          <div style="font-weight:700;color:#34d399;">RS Rujukan Evakuasi Terdekat: ${h.name} (${h.distance_km} km)</div>
          <div style="color:#94a3b8;margin-top:2px;">Status RS: ${h.status_badge || '[ZONA AMAN]'}</div>
          <button class="evac-route-btn" style="margin-top:5px;" onclick="event.stopPropagation();drawEvacuationRoute(${sch.latitude}, ${sch.longitude}, ${h.latitude}, ${h.longitude}, '${cleanSchName}', '${cleanHName}', ${h.distance_km})">
            Gambar Rute Evakuasi
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="fac-item-header">
        <span class="fac-item-name">[SEKOLAH] ${sch.name}</span>
        <span class="fac-item-badge" style="background:${sch.badge_color || '#ef4444'}">${sch.alert_level}</span>
      </div>
      <div class="fac-item-meta">
        <span>Wilayah: ${sch.district}</span>
        <span>Peluang: <strong style="color:${probColor}">${sch.exposure_pct}%</strong></span>
        <span>Tiba: <strong>${early}</strong></span>
      </div>
      <div class="fac-item-action">
        <strong>Tindakan Dini:</strong> ${sch.action_detail}
      </div>
      ${evacSnippet}
    `;

    card.addEventListener("click", () => {
      map.flyTo([sch.latitude, sch.longitude], 13, { duration: 1.0 });
      selectFacility(sch.facility_id);
    });

    container.appendChild(card);
  });
}

function renderEvacHospitalsList(hospitals) {
  const container = document.getElementById("evacHospitalsList");
  if (!container) return;
  container.innerHTML = "";

  if (hospitals.length === 0) {
    container.innerHTML = `<div class="empty-state">Tidak ada data rumah sakit rujukan terdekat.</div>`;
    return;
  }

  hospitals.forEach(h => {
    const card = document.createElement("div");
    const borderClass = h.is_safe ? "safe-border" : (h.exposure_pct < 35 ? "triage-border" : "danger-border");
    card.className = `evac-hospital-card ${borderClass}`;

    const capsHtml = (h.capabilities || []).map(c => `<span class="evac-cap-pill">${c}</span>`).join("");
    const cleanHName = (h.name || '').replace(/'/g, "\\'");

    card.innerHTML = `
      <div class="evac-hospital-header">
        <div>
          <div class="evac-hospital-title">[FASKES] ${h.name}</div>
          <div style="font-size:10.5px;color:#94a3b8;">${h.district} &bull; ${h.status_badge}</div>
        </div>
        <div class="evac-hospital-dist mono">${h.distance_from_epicenter_km} km</div>
      </div>
      <div style="font-size:10.5px;color:#cbd5e1;margin-top:4px;line-height:1.4;">
        <strong>Peran Kesiapsiagaan:</strong> ${h.evac_recommendation}
      </div>
      <div class="evac-caps-row">${capsHtml}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
        <span style="font-size:10px;color:#f59e0b;font-weight:600;">Hotline: ${h.emergency_hotline}</span>
        <button class="evac-route-btn" onclick="event.stopPropagation();map.flyTo([${h.latitude}, ${h.longitude}], 13, {duration: 1.0});selectFacility('${h.facility_id}')">
          Fokus di Peta
        </button>
      </div>
    `;

    card.addEventListener("click", () => {
      map.flyTo([h.latitude, h.longitude], 13, { duration: 1.0 });
      selectFacility(h.facility_id);
    });

    container.appendChild(card);
  });
}

let topClusterIdToExtinguish = null;

function loadLapis2Features(formatR) {
  if (!currentRunId) return;

  const isFire = currentHazard === "fire";
  document.getElementById("fireRankingSection").classList.toggle("hidden", !isFire);
  document.getElementById("carbonSection").classList.toggle("hidden", !isFire);
  document.getElementById("landWaterSection").classList.toggle("hidden", isFire);

  // 1. Kebakaran: Karbon & Ranking Klaster
  if (isFire) {
    fetch(`${API_BASE}/runs/${currentRunId}/carbon`)
      .then(r => r.json())
      .then(carb => {
        document.getElementById("mCarbonTotal").textContent = formatR(carb.total_co2e_tonnes);
        document.getElementById("mCarbonPeat").textContent = `${formatR(carb.peat_emissions_tonnes)} Ton`;
        document.getElementById("mCarbonNonPeat").textContent = `${formatR(carb.non_peat_emissions_tonnes)} Ton`;
      }).catch(() => {});

    fetch(`${API_BASE}/runs/${currentRunId}/ranking`)
      .then(r => r.json())
      .then(rnk => {
        const clusters = rnk.ranked_clusters || [];
        const box = document.getElementById("rankingList");
        box.innerHTML = "";
        if (clusters.length === 0) {
          box.innerHTML = "<div class='note-sub'>Tidak ada klaster titik api.</div>";
          return;
        }

        topClusterIdToExtinguish = clusters[0].cluster_id;
        const extBtn = document.getElementById("btnExtinguishTop");
        extBtn.classList.remove("hidden");
        extBtn.textContent = `[PRIORITAS] Padamkan Klaster #${topClusterIdToExtinguish} (${clusters[0].hotspot_count} titik api)`;

        clusters.slice(0, 4).forEach(c => {
          const item = document.createElement("div");
          item.className = "decision-row";
          item.style.padding = "3px 0";
          item.innerHTML = `<span>#${c.rank} Klaster ${c.cluster_id} (${c.hotspot_count} titik):</span><strong class="mono">${c.total_frp_mw} MW (Skor: ${c.exposure_contribution_score})</strong>`;
          box.appendChild(item);
        });
      }).catch(() => {});
  } else {
    // 2. Gunung: Sawah & Sumber Air
    fetch(`${API_BASE}/runs/${currentRunId}/land-water`)
      .then(r => r.json())
      .then(lw => {
        document.getElementById("mCropland").textContent = formatR(lw.cropland_exposed_ha);
        document.getElementById("mWaterSources").textContent = formatR(lw.water_sources_exposed_count);
        document.getElementById("ashWetnessWarning").textContent = lw.ash_wetness_warning;
      }).catch(() => {});
  }

  // 3. Efek Pencucian Hujan
  fetch(`${API_BASE}/runs/${currentRunId}/rain-effect`)
    .then(r => r.json())
    .then(re => {
      document.getElementById("mRainPopReduced").textContent = formatR(re.population_exposure_reduced);
      document.getElementById("mRainAreaReduced").textContent = formatR(re.area_footprint_reduced_km2);
      document.getElementById("rainCaveatText").textContent = re.hazard_specific_warning;
    }).catch(() => {});

  // 4. Anjuran Tindakan Resmi (D16)
  fetch(`${API_BASE}/runs/${currentRunId}/advice`)
    .then(r => r.json())
    .then(adv => {
      const box = document.getElementById("adviceContent");
      box.innerHTML = "";
      (adv.sourced_advice || []).forEach(a => {
        const d = document.createElement("div");
        d.style.marginBottom = "6px";
        d.innerHTML = `<strong style="color:#38bdf8;">&bull; ${a.action}</strong><br><small style="color:#9aa49e">Sumber: ${a.source} (${a.verified_on})</small>`;
        box.appendChild(d);
      });
      if (adv.additional_guidance && !adv.additional_guidance.available) {
        const sub = document.createElement("div");
        sub.style.fontSize = "11px";
        sub.style.color = "#d97706";
        sub.style.marginTop = "4px";
        sub.textContent = adv.additional_guidance.reason;
        box.appendChild(sub);
      }
    }).catch(() => {});
}

// =============================================================================
// 9. Timeline Animasi & Pemutaran Jam Dispersi
// =============================================================================
function toggleTimePlay() {
  const btn = document.getElementById("btnPlayPauseTime");
  const slider = document.getElementById("timeSlider");
  
  if (timePlayInterval) {
    clearInterval(timePlayInterval);
    timePlayInterval = null;
    btn.textContent = "▶";
  } else {
    btn.textContent = "II";
    timePlayInterval = setInterval(() => {
      let val = parseInt(slider.value) + 1;
      if (val > 48) val = 0;
      slider.value = val;
      document.getElementById("timeDisplay").textContent = `T + ${val < 10 ? '0' : ''}${val}:00 Jam`;
      updateTiersOnMap(val);
    }, 450);
  }
}

// =============================================================================
// 10. Kontrol Drawer Samping & Modal Legenda
// =============================================================================
function toggleDrawer() {
  const drawer = document.getElementById("commandDrawer");
  const ws = document.querySelector(".tactical-workspace");
  drawer.classList.toggle("collapsed");
  ws.classList.toggle("drawer-collapsed");
}

function openDrawer() {
  const drawer = document.getElementById("commandDrawer");
  const ws = document.querySelector(".tactical-workspace");
  drawer.classList.remove("collapsed");
  ws.classList.remove("drawer-collapsed");
}

function closeDrawer() {
  const drawer = document.getElementById("commandDrawer");
  const ws = document.querySelector(".tactical-workspace");
  drawer.classList.add("collapsed");
  ws.classList.add("drawer-collapsed");
}

function openLegendModal() {
  document.getElementById("legendModal").classList.remove("hidden");
}

function closeLegendModal() {
  document.getElementById("legendModal").classList.add("hidden");
}

// =============================================================================
// 11. Event Listeners & Bootstrapping
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  initMap();

  // Top Nav Buttons
  document.getElementById("btnResetView").addEventListener("click", resetToIndonesiaView);
  document.getElementById("btnToggleDrawer").addEventListener("click", toggleDrawer);
  document.getElementById("btnCloseDrawer").addEventListener("click", closeDrawer);
  document.getElementById("btnOpenLegend").addEventListener("click", openLegendModal);
  document.getElementById("btnCloseLegend").addEventListener("click", closeLegendModal);

  // Live Sync Sensor NASA & Cuaca
  const btnSync = document.getElementById("btnLiveSync");
  if (btnSync) {
    btnSync.addEventListener("click", () => {
      btnSync.innerHTML = `<span class="nav-btn-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H7v-2h4V6h2v7z"/></svg></span> Sinkron...`;
      fetch(`${API_BASE}/layers/sync-live`, { method: "POST" })
        .then(r => r.json())
        .then(res => {
          btnSync.innerHTML = `<span class="nav-btn-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span> Terhubung`;
          setTimeout(() => { btnSync.innerHTML = `<span class="nav-btn-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A7.96 7.96 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L14 10h7V3l-3.35 3.35z"/></svg></span> Live Sync`; }, 2500);
          loadSummaryKpi();
          loadNationalForests();
          loadHotspots();
        })
        .catch(() => {
          btnSync.innerHTML = `<span class="nav-btn-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg></span> Galat`;
          setTimeout(() => { btnSync.innerHTML = `<span class="nav-btn-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A7.96 7.96 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L14 10h7V3l-3.35 3.35z"/></svg></span> Live Sync`; }, 2500);
        });
    });
  }

  // Filter Tab Sekolah vs Faskes
  const tabSch = document.getElementById("tabFilterSchools");
  const tabHl = document.getElementById("tabFilterHealth");
  if (tabSch && tabHl) {
    tabSch.addEventListener("click", () => {
      currentFacTab = "schools";
      tabSch.classList.add("active");
      tabHl.classList.remove("active");
      renderImpactedFacilitiesList();
    });
    tabHl.addEventListener("click", () => {
      currentFacTab = "healthcare";
      tabHl.classList.add("active");
      tabSch.classList.remove("active");
      renderImpactedFacilitiesList();
    });
  }

  // Layer Toggles
  document.getElementById("layerToggleVolcanoes").addEventListener("change", e => {
    if (volcanoesLayer) {
      if (e.target.checked) volcanoesLayer.addTo(map);
      else map.removeLayer(volcanoesLayer);
    }
  });

  const toggleForests = document.getElementById("layerToggleForests");
  if (toggleForests) {
    toggleForests.addEventListener("change", e => {
      if (forestsLayer) {
        if (e.target.checked) forestsLayer.addTo(map);
        else map.removeLayer(forestsLayer);
      }
    });
  }

  document.getElementById("layerToggleHotspots").addEventListener("change", e => {
    if (hotspotsLayer) {
      if (e.target.checked) hotspotsLayer.addTo(map);
      else map.removeLayer(hotspotsLayer);
    }
  });

  document.getElementById("layerTogglePlume").addEventListener("change", e => {
    if (currentTiersLayer) {
      if (e.target.checked) currentTiersLayer.addTo(map);
      else map.removeLayer(currentTiersLayer);
    }
  });

  document.getElementById("layerToggleFacilities").addEventListener("change", e => {
    if (facilitiesLayer) {
      if (e.target.checked) facilitiesLayer.addTo(map);
      else map.removeLayer(facilitiesLayer);
    }
  });

  // Hazard & Event Selects
  const hazardSel = document.getElementById("hazardSelect");
  const eventSel = document.getElementById("eventSelect");

  hazardSel.addEventListener("change", onHazardChanged);
  eventSel.addEventListener("change", onEventSelectChanged);

  // Mode Simulasi (Auto vs Experiment)
  const modeRadios = document.querySelectorAll('input[name="simMode"]');
  const expPanel = document.getElementById("experimentPanel");
  modeRadios.forEach(r => {
    r.addEventListener("change", e => {
      expPanel.classList.toggle("hidden", e.target.value !== "experiment");
    });
  });

  // Slider Waktu & Step Buttons
  const slider = document.getElementById("timeSlider");
  const timeDisp = document.getElementById("timeDisplay");

  function updateStepButtonsActive(val) {
    document.querySelectorAll(".step-btn").forEach(b => {
      const hr = parseInt(b.getAttribute("data-hour"));
      b.classList.toggle("active", hr === val);
    });
  }

  slider.addEventListener("input", e => {
    const val = parseInt(e.target.value);
    timeDisp.textContent = `T + ${val < 10 ? '0' : ''}${val}:00 Jam`;
    updateStepButtonsActive(val);
    updateTiersOnMap(val);
  });

  document.querySelectorAll(".step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const hr = parseInt(btn.getAttribute("data-hour"));
      slider.value = hr;
      timeDisp.textContent = `T + ${hr < 10 ? '0' : ''}${hr}:00 Jam`;
      updateStepButtonsActive(hr);
      updateTiersOnMap(hr);
    });
  });

  function toggleTimePlay() {
    const btn = document.getElementById("btnPlayPauseTime");
    if (timePlayInterval) {
      clearInterval(timePlayInterval);
      timePlayInterval = null;
      if (btn) {
        btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        btn.title = "Putar Animasi Jam";
      }
    } else {
      if (btn) {
        btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
        btn.title = "Jeda Animasi";
      }
      timePlayInterval = setInterval(() => {
        let cur = parseInt(slider.value) + 1;
        if (cur > 48) cur = 0;
        slider.value = cur;
        timeDisp.textContent = `T + ${cur < 10 ? '0' : ''}${cur}:00 Jam`;
        updateStepButtonsActive(cur);
        updateTiersOnMap(cur);
      }, 1000);
    }
  }

  document.getElementById("btnPlayPauseTime").addEventListener("click", toggleTimePlay);

  // Tombol Run Simulation Utama
  document.getElementById("btnRunSim").addEventListener("click", runSimulation);

  // Tombol Padamkan Klaster
  document.getElementById("btnExtinguishTop").addEventListener("click", () => {
    if (!currentRunId || topClusterIdToExtinguish === null) return;
    const resBox = document.getElementById("extinguishDeltaResult");
    resBox.classList.remove("hidden");
    resBox.innerHTML = "Menghitung delta pemadaman...";

    fetch(`${API_BASE}/fire/extinguish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        run_id: currentRunId,
        extinguish_cluster_ids: [topClusterIdToExtinguish]
      })
    })
      .then(r => r.json())
      .then(d => {
        resBox.innerHTML = `
          <div style="background:#17221d;border:1px solid #10b981;border-radius:4px;padding:8px;margin-top:6px;">
            <strong style="color:#34d399">Pemadaman Berhasil Disimulasikan (-${d.reduction_percentage}% FRP)</strong>
            <div class="decision-row"><span>Penduduk Terlindungi:</span><span class="mono">${Math.round(d.population_reduced.median).toLocaleString()} jiwa</span></div>
            <div class="decision-row"><span>Sekolah Terlindungi:</span><span class="mono">${Math.round(d.schools_saved.median)} sekolah</span></div>
            <div class="decision-row"><span>Emisi Karbon Dicegah:</span><span class="mono">${Math.round(d.carbon_reduced_co2e_tonnes.median).toLocaleString()} Ton CO2e</span></div>
          </div>
        `;
      })
      .catch(err => {
        resBox.innerHTML = `<span style="color:#ef4444">Galat: ${err}</span>`;
      });
  });

  // Tombol Sensitivitas
  document.getElementById("btnRunSensitivity").addEventListener("click", () => {
    if (!currentRunId) {
      alert("Jalankan simulasi terlebih dahulu.");
      return;
    }
    const param = document.getElementById("sensitivityParamSelect").value;
    const box = document.getElementById("sensitivityChartBox");
    box.classList.remove("hidden");
    box.innerHTML = "<div class='note-sub'>Menghitung sapuan sensitivitas parameter...</div>";

    fetch(`${API_BASE}/runs/sensitivity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: currentRunId, parameter_name: param })
    })
      .then(r => r.json())
      .then(res => {
        const curve = res.sensitivity_curve || [];
        const maxPop = Math.max(...curve.map(pt => pt.median_population_exposed || 0), 1);

        let html = `<div style="background:#141b17;padding:10px;border-radius:6px;border:1px solid #2c4236;">`;
        html += `<div style="display:flex;justify-content:space-between;margin-bottom:8px;">`;
        html += `  <strong style="color:#38bdf8;font-size:11.5px;">Respons Sensitivitas ${res.parameter_swept}:</strong>`;
        html += `  <span class="mono" style="font-size:10px;color:#9ca3af;">P50 Ensemble</span>`;
        html += `</div>`;

        curve.forEach(pt => {
          const pop = Math.round(pt.median_population_exposed);
          const area = Math.round(pt.median_area_km2);
          const pct = Math.min(Math.max(Math.round((pop / maxPop) * 100), 4), 100);

          html += `
            <div class="sens-card">
              <div class="sens-row-header">
                <span>Nilai <strong>${pt.parameter_value} ${pt.unit}</strong>:</span>
                <span class="mono" style="color:#38bdf8;">${pop.toLocaleString()} jiwa <small style="color:#64748b">(${area.toLocaleString()} km²)</small></span>
              </div>
              <div class="sens-bar-track">
                <div class="sens-bar-fill" style="width:${pct}%"></div>
              </div>
            </div>
          `;
        });
        html += `</div>`;
        box.innerHTML = html;
      })
      .catch(err => {
        box.innerHTML = `<span style="color:#ef4444">Galat: ${err}</span>`;
      });
  });

  // Tombol Putar Demo Otomatis
  let demoInterval = null;
  document.getElementById("btnPlayDemo").addEventListener("click", () => {
    const eventId = document.getElementById("eventSelect").value;
    const progText = document.getElementById("runProgressText");
    progText.textContent = "Memulai putar demo otomatis...";

    fetch(`${API_BASE}/demo/play/${eventId}`)
      .then(r => r.json())
      .then(demo => {
        let stepIdx = 0;
        if (demoInterval) clearInterval(demoInterval);

        demoInterval = setInterval(() => {
          if (stepIdx >= demo.steps.length) {
            clearInterval(demoInterval);
            demoInterval = null;
            progText.textContent = "Selesai memutar demo skenario.";
            return;
          }

          const step = demo.steps[stepIdx];
          slider.value = step.hour;
          timeDisp.textContent = step.time_label;
          progText.textContent = step.commentary;
          updateTiersOnMap(step.hour);
          stepIdx++;
        }, 1200);
      })
      .catch(err => {
        progText.textContent = `Galat demo: ${err}`;
      });
  });

  // Tombol Ekspor Cetak
  document.getElementById("btnExportPrint").addEventListener("click", () => {
    if (!currentRunId) {
      alert("Jalankan simulasi terlebih dahulu sebelum mengekspor laporan.");
      return;
    }
    window.open(`${API_BASE}/runs/${currentRunId}/export?format=html`, "_blank");
  });

  // Tombol Uji Validasi
  document.getElementById("btnCheckValidation").addEventListener("click", () => {
    const eventId = document.getElementById("eventSelect").value;
    const box = document.getElementById("validationResultBox");
    box.innerHTML = "Memeriksa evaluasi validasi kejadian...";

    fetch(`${API_BASE}/validation/${eventId}`)
      .then(r => r.json())
      .then(val => {
        if (val.status === "not_testable") {
          box.innerHTML = `
            <div style="background:#1f2937;border-left:3px solid #f59e0b;padding:6px 8px;margin-top:4px;">
              <strong style="color:#f59e0b">STATUS: NOT TESTABLE</strong><br>
              ${val.reason}<br>
              <small style="color:#9ca3af">${val.validation_note}</small>
            </div>
          `;
        } else {
          const hitRatePct = Math.round((val.district_hit_rate || 0) * 100);
          const fss = val.fractions_skill_score || "-";
          const av = val.aviation_impact || {};
          box.innerHTML = `
            <div style="background:#13211c;border-left:3px solid #10b981;padding:6px 8px;margin-top:4px;">
              <strong style="color:#34d399">Evaluasi Lapangan (${val.resolution})</strong>
              <div class="decision-row"><span>District Hit Rate:</span><strong class="mono">${hitRatePct}% (${val.reported_districts_evaluated ? val.reported_districts_evaluated.length : 0} kab)</strong></div>
              <div class="decision-row"><span>Fractions Skill Score:</span><strong class="mono">${fss}</strong></div>
              <div class="decision-row"><span>${av.label || 'Bandara'}:</span><span class="mono">${av.airport_name || '-'} (${Math.round((av.airspace_exposure_probability||0)*100)}% risiko jalur udara)</span></div>
              <div style="font-size:10px;color:#9ca3af;margin-top:4px;">${val.confidence_caveat}</div>
            </div>
          `;
        }
      })
      .catch(err => {
        box.innerHTML = `<span style="color:#ef4444">Galat: ${err}</span>`;
      });
  });

  // Inisialisasi Tab Navigasi Laci Kanan (5 Tab) & Dock Melayang Kiri
  initDrawerTabs();
  initDockToggle();
  setupCustomPointMode();
  initCustomControls();
});

function initDrawerTabs() {
  document.querySelectorAll(".d-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      switchDrawerTab(targetId);
    });
  });
}

function switchDrawerTab(tabId) {
  document.querySelectorAll(".d-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  const activeBtn = document.querySelector(`.d-tab-btn[data-tab='${tabId}']`);
  const activePane = document.getElementById(tabId);
  if (activeBtn) activeBtn.classList.add("active");
  if (activePane) activePane.classList.add("active");
}

function initDockToggle() {
  const dockBtn = document.getElementById("btnToggleDock");
  const dock = document.getElementById("floatingControlDock");
  if (dockBtn && dock) {
    dockBtn.addEventListener("click", () => {
      dock.classList.toggle("minimized");
      dockBtn.innerHTML = dock.classList.contains("minimized") ? "+" : "&minus;";
    });
  }
}

let isCustomPointMode = false;
let customPointCoords = null;
let customPointMarker = null;

function setupCustomPointMode() {
  const btnToggle = document.getElementById("btnToggleCustomPoint");
  const badge = document.getElementById("customPointBadge");
  const coordText = document.getElementById("customPointCoordText");
  const btnCancel = document.getElementById("btnCancelCustomPoint");

  if (!btnToggle) return;

  btnToggle.addEventListener("click", () => {
    isCustomPointMode = !isCustomPointMode;
    if (isCustomPointMode) {
      btnToggle.textContent = "Batal Mode Titik";
      btnToggle.style.color = "#f87171";
      if (badge) {
        badge.classList.remove("hidden");
        badge.style.display = "flex";
      }
      if (coordText) coordText.textContent = "Klik di mana saja pada peta...";
      const mapElem = document.getElementById("map");
      if (mapElem) mapElem.style.cursor = "crosshair";
    } else {
      cancelCustomPoint();
    }
  });

  if (btnCancel) {
    btnCancel.addEventListener("click", cancelCustomPoint);
  }

  map.on("click", (e) => {
    if (!isCustomPointMode) return;
    customPointCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    if (customPointMarker) {
      map.removeLayer(customPointMarker);
    }
    const hazard = document.getElementById("hazardSelect").value;
    const pinColor = hazard === "volcano" ? "#ef4444" : "#f59e0b";
    const customIcon = L.divIcon({
      className: "custom-point-pin",
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:34px;height:34px;border-radius:50%;background:${pinColor};opacity:0.35;animation:radar-pulse 1.4s infinite;"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:${pinColor};border:2px solid #fff;box-shadow:0 0 12px ${pinColor};"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    customPointMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: customIcon }).addTo(map);
    customPointMarker.bindPopup(`<b>Titik Kustom Peta Indonesia</b><br>Lintang: ${e.latlng.lat.toFixed(4)}<br>Bujur: ${e.latlng.lng.toFixed(4)}<br><small style="color:#38bdf8">Siap disimulasikan (${hazard === 'volcano' ? 'Abu Vulkanik' : 'Asap Karhutla'})</small>`).openPopup();
    if (coordText) coordText.textContent = `${e.latlng.lat.toFixed(3)}, ${e.latlng.lng.toFixed(3)}`;
  });
}

function cancelCustomPoint() {
  isCustomPointMode = false;
  customPointCoords = null;
  if (customPointMarker) {
    map.removeLayer(customPointMarker);
    customPointMarker = null;
  }
  const btnToggle = document.getElementById("btnToggleCustomPoint");
  const badge = document.getElementById("customPointBadge");
  if (btnToggle) {
    btnToggle.textContent = "Klik Peta Bebas";
    btnToggle.style.color = "#38bdf8";
  }
  if (badge) {
    badge.classList.add("hidden");
    badge.style.display = "none";
  }
  const mapElem = document.getElementById("map");
  if (mapElem) mapElem.style.cursor = "";
}

// =============================================================================
// Inisialisasi Kontrol Interaktif Taktis (Switcher Bahaya & Combobox Pencarian)
// =============================================================================
function initCustomControls() {
  // 1. Tombol Switcher Bahaya (Gunung Api vs Karhutla)
  const btnVolc = document.getElementById("btnHazardVolcano");
  const btnFire = document.getElementById("btnHazardFire");
  const tabVolc = document.getElementById("comboTabVolcano");
  const tabFire = document.getElementById("comboTabFire");
  const hazardSel = document.getElementById("hazardSelect");

  function switchToHazard(mode) {
    if (hazardSel) {
      const changed = hazardSel.value !== mode;
      hazardSel.value = mode;
      currentHazard = mode;
      if (changed) {
        hazardSel.dispatchEvent(new Event("change"));
      } else {
        onHazardChanged();
      }
    }
  }

  if (btnVolc) btnVolc.addEventListener("click", () => switchToHazard("volcano"));
  if (btnFire) btnFire.addEventListener("click", () => switchToHazard("fire"));
  if (tabVolc) tabVolc.addEventListener("click", (e) => { e.stopPropagation(); switchToHazard("volcano"); });
  if (tabFire) tabFire.addEventListener("click", (e) => { e.stopPropagation(); switchToHazard("fire"); });

  // 2. Trigger Dropdown Combobox Lokasi
  const trigger = document.getElementById("eventComboboxTrigger");
  if (trigger) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCombobox();
    });
  }

  // 3. Kolom Pencarian Cepat
  const searchInput = document.getElementById("eventSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", filterComboboxItems);
    searchInput.addEventListener("click", (e) => e.stopPropagation());
  }

  // 4. Tombol Bersihkan Pencarian (✕)
  const clearBtn = document.getElementById("btnClearSearch");
  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (searchInput) {
        searchInput.value = "";
        filterComboboxItems();
        searchInput.focus();
      }
    });
  }

  // 5. Filter Cepat Berdasarkan Pulau / Status Siaga
  document.querySelectorAll(".chip-filter-btn").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".chip-filter-btn").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentComboboxFilter = chip.getAttribute("data-filter") || "all";
      filterComboboxItems();
    });
  });

  // 6. Tutup popover jika mengklik di luar wrapper combobox
  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("eventComboboxWrapper");
    if (wrapper && !wrapper.contains(e.target)) {
      closeCombobox();
    }
  });

  // 7. Tombol ESC untuk menutup combobox
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCombobox();
    }
  });

  // Sinkronkan status awal
  syncHazardSwitcherUI();
  syncComboboxTriggerUI(document.getElementById("eventSelect") ? document.getElementById("eventSelect").value : null);
}
