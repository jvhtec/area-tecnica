
import React from "react";
import { Check, ChevronDown } from "lucide-react";

interface CalendarFiltersProps {
  distinctJobTypes: string[];
  selectedJobTypes: string[];
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  onJobTypeSelection: (type: string) => void;
  handleJobTypeSelection?: (type: string) => void; // Added for backward compatibility
}

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  distinctJobTypes,
  selectedJobTypes,
  isDropdownOpen,
  setIsDropdownOpen,
  onJobTypeSelection,
  handleJobTypeSelection,
}) => {
  // Use the appropriate function (handleJobTypeSelection is kept for backward compatibility)
  const handleSelection = onJobTypeSelection || handleJobTypeSelection;
  
  return (
    <div className="relative mb-4">
      <button
        className="border border-gray-300 rounded-md py-1 px-2 text-sm w-full flex items-center justify-between"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        {selectedJobTypes.length > 0 ? selectedJobTypes.join(", ") : "Select Job Types"}
        <ChevronDown className="h-4 w-4 ml-2" />
      </button>
      {isDropdownOpen && (
        <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md">
          {distinctJobTypes.map((type) => (
            <div
              key={type}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => handleSelection?.(type)}
            >
              <span className="text-sm text-black dark:text-white">{type}</span>
              {selectedJobTypes.includes(type) && <Check className="h-4 w-4 text-blue-500" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
