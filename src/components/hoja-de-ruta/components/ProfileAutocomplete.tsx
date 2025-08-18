import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { User, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  dni: string | null;
  department: string | null;
  role: string | null;
}

interface ProfileAutocompleteProps {
  value: string;
  onSelect: (profile: Partial<Profile>) => void;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const ProfileAutocomplete: React.FC<ProfileAutocompleteProps> = ({
  value,
  onSelect,
  onChange,
  placeholder = "Buscar por nombre...",
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch profiles based on search term
  const fetchProfiles = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setProfiles([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, dni, department, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) {
        console.error('Error fetching profiles:', error);
        setProfiles([]);
        return;
      }

      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProfiles(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
  };

  const handleProfileSelect = (profile: Profile) => {
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    const firstName = (profile.first_name || fullName.split(/\s+/)[0] || '').trim();
    onChange(firstName);
    
    onSelect({
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      dni: profile.dni,
      department: profile.department,
      role: profile.role,
      // Provide full_name so consumers can reliably parse
      full_name: fullName
    } as any);
    
    setIsOpen(false);
    setProfiles([]);
  };

  const handleInputFocus = () => {
    if (value.length >= 2) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={cn("pl-10 border-2 focus:border-orange-300", className)}
        />
      </div>

      <AnimatePresence>
        {isOpen && profiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1"
          >
            <Card className="border-2 border-orange-200 shadow-lg max-h-60 overflow-y-auto">
              {loading && (
                <div className="p-3 text-center text-sm text-gray-500">
                  Buscando...
                </div>
              )}
              
              {!loading && profiles.map((profile, index) => {
                const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
                return (
                  <motion.div
                    key={profile.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3 hover:bg-orange-50 cursor-pointer border-b last:border-b-0 transition-colors"
                    onClick={() => handleProfileSelect(profile)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {fullName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {profile.dni && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {profile.dni}
                            </span>
                          )}
                          {profile.department && (
                            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                              {profile.department}
                            </span>
                          )}
                          {profile.role && (
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              {profile.role}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};