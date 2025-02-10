
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@/components/query-client-provider";
import { TimezoneProvider } from "@/contexts/TimezoneContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider>
      <ThemeProvider>
        <TimezoneProvider>
          {children}
          <Toaster />
        </TimezoneProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
