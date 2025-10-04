import { createContext, useContext, ReactNode } from 'react';
import { Department } from '@/types/equipment';

interface DepartmentContextValue {
  department: Department;
}

const DepartmentContext = createContext<DepartmentContextValue | undefined>(undefined);

export function DepartmentProvider({ department, children }: { department: Department; children: ReactNode }) {
  return (
    <DepartmentContext.Provider value={{ department }}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment() {
  const context = useContext(DepartmentContext);
  if (!context) {
    throw new Error('useDepartment must be used within DepartmentProvider');
  }
  return context;
}
