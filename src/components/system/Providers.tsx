"use client";

import { AuthProvider } from "@/lib/auth/AuthContext";
import { ConfigProvider } from "@/lib/config/ConfigContext";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import { CustomizeProvider } from "@/lib/customize/CustomizeContext";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { UpdateBanner } from "@/components/app/UpdateBanner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CustomizeProvider>
          <ConfigProvider>
            {children}
            <ServiceWorkerRegister />
            <UpdateBanner />
          </ConfigProvider>
        </CustomizeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
