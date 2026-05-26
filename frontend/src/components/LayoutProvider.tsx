"use client";
import { ReactNode } from "react";
import { Provider } from "react-redux";
import { usePathname } from "next/navigation";
import store from "@/app/Redux/store";
import { Toaster } from "react-hot-toast";

// Import your custom components
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const excludedPaths = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify",
    "/verify-otp",
  ];

  const shouldRenderLayout = !excludedPaths.includes(pathname || "");

  return (
    <Provider store={store}>
      {/* React Hot Toast */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#fff",
            color: "#363636",
            boxShadow: "0 3px 10px rgba(0, 0, 0, 0.1)",
            borderRadius: "8px",
            padding: "12px 16px",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />

      {shouldRenderLayout ? (
        <div className="w-full min-h-screen  flex">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Header - Fixed at top */}
            <header className="sticky top-0 z-50">
              <Header />
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6">
              <div className="w-full px-0 py-6 mx-auto max-w-7xl">
                {children}
              </div>
            </main>

            {/* Footer */}
            <footer className="  py-4">
              <Footer />
            </footer>
          </div>
        </div>
      ) : (
        <div className="w-full min-h-screen ">{children}</div>
      )}
    </Provider>
  );
};

export default LayoutProvider;
