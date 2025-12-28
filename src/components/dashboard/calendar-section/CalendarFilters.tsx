import React from "react";
import { Check, ChevronDown } from "lucide-react";

export interface CalendarFiltersProps {
  distinctJobTypes: string[];
  selectedJobTypes: string[];
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  onJobTypeSelection: (type: string) => void;
  distinctJobStatuses: string[];
  selectedJobStatuses: string[];
  isStatusDropdownOpen: boolean;
  setIsStatusDropdownOpen: (open: boolean) => void;
  onJobStatusSelection: (status: string) => void;
}

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  distinctJobTypes,
  selectedJobTypes,
  isDropdownOpen,
  setIsDropdownOpen,
  onJobTypeSelection,
  distinctJobStatuses,
  selectedJobStatuses,
  isStatusDropdownOpen,
  setIsStatusDropdownOpen,
  onJobStatusSelection,
}) => {
  return (
    <div className="flex gap-4 mb-4">
      <div className="relative">
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
                onClick={() => onJobTypeSelection(type)}
              >
                <span className="text-sm text-black dark:text-white">{type}</span>
                {selectedJobTypes.includes(type) && <Check className="h-4 w-4 text-blue-500" />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          className="border border-gray-300 rounded-md py-1 px-2 text-sm w-full flex items-center justify-between"
          onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
        >
          {selectedJobStatuses.length > 0 ? selectedJobStatuses.join(", ") : "Select Job Status"}
          <ChevronDown className="h-4 w-4 ml-2" />
        </button>
        {isStatusDropdownOpen && (
          <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md">
            {distinctJobStatuses.map((status) => (
              <div
                key={status}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => onJobStatusSelection(status)}
              >
                <span className="text-sm text-black dark:text-white">{status}</span>
                {selectedJobStatuses.includes(status) && <Check className="h-4 w-4 text-blue-500" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

