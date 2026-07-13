import { Button } from "@/components/ui/button";

export type ProfileSection = "profile" | "folders" | "tools" | "notifications" | "security";

interface ProfileMobileSectionNavProps {
  activeSection: ProfileSection;
  canUseFolders: boolean;
  onSectionChange: (section: ProfileSection) => void;
}

export const ProfileMobileSectionNav = ({
  activeSection,
  canUseFolders,
  onSectionChange,
}: ProfileMobileSectionNavProps) => {
  const sections: Array<[ProfileSection, string]> = [
    ["profile", "Perfil"],
    ...(canUseFolders ? [["folders", "Carpetas"]] as Array<[ProfileSection, string]> : []),
    ["tools", "Herramientas"],
    ["notifications", "Avisos"],
    ["security", "Seguridad"],
  ];

  return (
    <nav
      aria-label="Secciones del perfil"
      className="sticky top-0 z-20 -mx-4 overflow-x-auto border-y bg-background/95 px-4 py-3 backdrop-blur md:hidden"
    >
      <div className="flex min-w-max gap-2">
        {sections.map(([section, label]) => (
          <Button
            key={section}
            type="button"
            size="sm"
            variant={activeSection === section ? "default" : "outline"}
            aria-current={activeSection === section ? "page" : undefined}
            onClick={() => onSectionChange(section)}
          >
            {label}
          </Button>
        ))}
      </div>
    </nav>
  );
};
