import React, { useState, useRef, useEffect, useMemo } from "react";
import { FiChevronDown, FiSearch, FiCheck, FiX } from "react-icons/fi";

const CategorySelect = ({
  value = "all",
  onChange,
  categories = [],
  placeholder = "Select Category",
  includeAllOption = true,
  allLabel = "All Categories",
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const validCats = categories.filter((c) => c && c.status !== "deleted");
    if (!query) return validCats;
    return validCats.filter((c) => (c.title || "").toLowerCase().includes(query));
  }, [categories, searchQuery]);

  // Find currently selected category title
  const selectedCategoryTitle = useMemo(() => {
    if (value === "all" || !value) {
      return includeAllOption ? allLabel : placeholder;
    }
    const found = categories.find((c) => String(c.id) === String(value) || String(c._id) === String(value));
    return found?.title || placeholder;
  }, [value, categories, includeAllOption, allLabel, placeholder]);

  const handleSelect = (val) => {
    if (onChange) onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-lg text-sm font-medium transition-all shadow-sm ${
          isOpen
            ? "border-primary-500 ring-2 ring-primary-500/20 text-gray-900"
            : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50/50"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-gray-100" : "cursor-pointer"}`}
      >
        <span className="truncate">{selectedCategoryTitle}</span>
        <FiChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ml-2 flex-shrink-0 ${
            isOpen ? "transform rotate-180 text-primary-600" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-fadeIn">
          {/* Search Box */}
          <div className="p-2 border-b border-gray-100 bg-gray-50/70">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-800 placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Categories List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-transparent overscroll-contain">
            {includeAllOption && !searchQuery && (
              <button
                type="button"
                onClick={() => handleSelect("all")}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between transition-colors ${
                  value === "all" || !value
                    ? "bg-primary-50 text-primary-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>{allLabel}</span>
                {(value === "all" || !value) && <FiCheck className="w-4 h-4 text-primary-600 flex-shrink-0" />}
              </button>
            )}

            {filteredCategories.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                No categories found
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const catId = String(cat.id || cat._id);
                const isSelected = String(value) === catId;
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => handleSelect(catId)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-primary-50 text-primary-700 font-semibold"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className="truncate pr-2">{cat.title}</span>
                    {isSelected && <FiCheck className="w-4 h-4 text-primary-600 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count */}
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
            <span>{filteredCategories.length} categories available</span>
            {searchQuery && (
              <span className="text-gray-400">Filtered from {categories.length}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategorySelect;
