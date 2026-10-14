import { useEffect, useRef, useState } from "react"
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"

export interface DropdownItem {
  id: string | number
  label: string
  icon?: React.ReactNode
  badge?: string
  badgeColor?: string
}

export interface BasicDropdownProps {
  label: string
  items: DropdownItem[]
  value?: string | number
  searchable?: boolean
  searchPlaceholder?: string
  onChange?: (item: DropdownItem) => void
  className?: string
  menuWidthClass?: string
}

export default function BasicDropdown({
  label,
  items,
  value,
  searchable = false,
  searchPlaceholder = "Cari...",
  onChange,
  className = "",
  menuWidthClass = "w-full",
}: BasicDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedItem = items.find((it) => String(it.id) === String(value)) || null

  const filteredItems = searchable && searchQuery.trim() !== ""
    ? items.filter((it) => it.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : items

  const handleItemSelect = (item: DropdownItem) => {
    setIsOpen(false)
    setSearchQuery("")
    onChange?.(item)
  }

  // Fokus input saat dropdown dibuka
  useEffect(() => {
    if (isOpen && searchable) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchQuery("")
    }
  }, [isOpen, searchable])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const buttonId = "dropdown-button"

  return (
    <div ref={dropdownRef} className={`relative block w-full min-w-0 max-w-full ${className}`}>
      <button
        type="button"
        id={buttonId}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex w-full min-w-0 max-w-full items-center justify-between gap-1.5 rounded border border-[rgba(235,137,91,0.35)] bg-white/80 px-2.5 py-1.5 text-xs text-[#140f0e] shadow-xs transition-colors hover:bg-white hover:border-[#EB895B] focus:outline-none focus:border-[#EB895B] cursor-pointer !font-body"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <span className="block truncate font-normal text-[12px] text-[#140f0e] !font-body min-w-0">
            {selectedItem ? selectedItem.label : label}
          </span>
          {selectedItem?.badge && (
            <span
              className="text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wide shrink-0 whitespace-nowrap leading-none"
              style={{
                backgroundColor: selectedItem.badgeColor ? `${selectedItem.badgeColor}18` : "rgba(20, 15, 14, 0.08)",
                color: selectedItem.badgeColor || "#140f0e",
                border: `1px solid ${selectedItem.badgeColor ? `${selectedItem.badgeColor}35` : "rgba(20, 15, 14, 0.15)"}`
              }}
            >
              {selectedItem.badge}
            </span>
          )}
        </div>
        <motion.div
          className="text-[#EB895B] shrink-0 ml-1"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18 }}
        >
          <CaretDown size={14} weight="bold" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`absolute left-0 z-[1100] mt-1 max-h-56 ${menuWidthClass} overflow-hidden flex flex-col origin-top rounded border border-[rgba(235,137,91,0.4)] bg-[rgba(250,246,238,0.98)] text-[#140f0e] shadow-2xl backdrop-blur-md`}
            initial={{ opacity: 0, y: -4, scaleY: 0.97 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.97, transition: { duration: 0.1 } }}
            transition={{ type: "spring", bounce: 0.08, duration: 0.2 }}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby={buttonId}
          >
            {/* Input Filter Search di dalam Dropdown */}
            {searchable && (
              <div className="p-1.5 border-b border-black/5 bg-white/60 shrink-0">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-black/10 focus-within:border-[#EB895B]">
                  <MagnifyingGlass size={13} weight="bold" className="text-[#140f0e]/50 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full bg-transparent text-[11px] outline-none text-[#140f0e] placeholder:text-[#140f0e]/40 font-sans"
                  />
                </div>
              </div>
            )}

            {/* List Item Hasil Pencarian */}
            <div className="overflow-y-auto max-h-44 py-1">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-2 text-[10px] text-center text-[#140f0e]/60 font-sans">
                  Tidak ditemukan hasil
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {filteredItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id
                    return (
                      <motion.li
                        key={item.id}
                        role="none"
                        initial={{ opacity: 0, x: -3 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -3 }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleItemSelect(item)}
                          className={[
                            "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11.5px] transition-colors cursor-pointer !font-body",
                            "focus:outline-none focus:bg-black/5",
                            isSelected
                              ? "bg-[#EB895B]/15 text-[#EB895B] font-semibold"
                              : "text-[#140f0e] hover:bg-black/5"
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {item.icon && <span className="shrink-0">{item.icon}</span>}
                            <span className="truncate !font-body font-normal text-[#140f0e]">{item.label}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                            {item.badge && (
                              <span
                                className="text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded tracking-tight shrink-0 whitespace-nowrap leading-none"
                                style={{
                                  backgroundColor: item.badgeColor ? `${item.badgeColor}18` : "rgba(20, 15, 14, 0.08)",
                                  color: item.badgeColor || "#140f0e",
                                  border: `1px solid ${item.badgeColor ? `${item.badgeColor}35` : "rgba(20, 15, 14, 0.15)"}`
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                            {isSelected && (
                              <motion.span
                                className="text-[#EB895B] shrink-0"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                                aria-hidden
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </motion.span>
                            )}
                          </div>
                        </button>
                      </motion.li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

