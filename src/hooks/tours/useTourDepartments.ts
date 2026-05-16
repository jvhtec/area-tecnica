import { useState } from "react";
import { Department } from "@/types/department";

export const useTourDepartments = (currentDepartment: Department) => {
  const [departments, setDepartments] = useState<Department[]>([currentDepartment]);

  const handleDepartmentChange = (dept: Department, checked: boolean) => {
    if (checked) {
      setDepartments([...departments, dept]);
    } else {
      setDepartments(departments.filter(d => d !== dept));
    }
  };

  return {
    departments,
    handleDepartmentChange,
  };
};