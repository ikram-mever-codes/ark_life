"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Shield,
  CreditCard,
  Save,
  Globe,
  Phone,
  Mail,
  Loader2,
  Camera,
  Calendar,
  Fingerprint,
  Hash,
  Lock,
  Zap,
  Cpu,
  Orbit,
  CheckCircle2,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/app/Redux/store";
import {
  updateDetailedProfileSubmit,
  changePasswordSubmit,
  updateSubscriptionSubmit,
} from "@/api/auth";
import { toast } from "react-hot-toast";

const SettingsPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.user);

  const [activeTab, setActiveTab] = useState("profile");
  const [isSaving, setIsSaving] = useState(false);

  // Form States
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    region: "",
    bio: "",
    avatar: "",
  });

  const [securityData, setSecurityData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [selectedTier, setSelectedTier] = useState<any>(
    user?.subscriptionTier || "free",
  );

  // Sync state with Redux on mount or user change
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        gender: (user as any).gender || "Male",
        dob: (user as any).dob?.split("T")[0] || "",
        region: (user as any).region || "us",
        bio: (user as any).bio || "",
        avatar: (user as any).avatar || "",
      });
      setSelectedTier(user.subscriptionTier);
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (activeTab === "profile") {
        await updateDetailedProfileSubmit(profileData, dispatch);
      } else if (activeTab === "security") {
        if (securityData.newPassword !== securityData.confirmPassword) {
          toast.error("New signatures do not match.");
          return;
        }
        await changePasswordSubmit({
          oldPassword: securityData.oldPassword,
          newPassword: securityData.newPassword,
        });
        setSecurityData({
          oldPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else if (activeTab === "billing") {
        await updateSubscriptionSubmit(selectedTier, dispatch);
      }
    } catch (err) {
      console.error("Settings update failed", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white p-4 lg:p-12 font-sans selection:bg-primary selection:text-black relative overflow-hidden">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-1 bg-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">
                System Configuration
              </span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter italic uppercase leading-none">
              Account{" "}
              <span
                className="text-outline text-transparent"
                style={{ WebkitTextStroke: "1px white" }}
              >
                Control
              </span>
            </h1>
          </div>
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center gap-4 shadow-xl">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-gray-500">
                Node Status
              </p>
              <p className="text-xs font-mono text-primary italic">
                Fully Operational
              </p>
            </div>
            <Fingerprint className="text-primary" size={24} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Sidebar */}
          <aside className="lg:col-span-3 space-y-3">
            {[
              {
                id: "profile",
                label: "Identity Profile",
                icon: <User size={18} />,
                desc: "Personal Biometrics",
              },
              {
                id: "security",
                label: "Security Protocol",
                icon: <Shield size={18} />,
                desc: "Keys & Encryption",
              },
              {
                id: "billing",
                label: "Subscription",
                icon: <CreditCard size={18} />,
                desc: "Tier Management",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full group text-left p-5 rounded-[24px] border transition-all duration-300 ${activeTab === tab.id ? "bg-primary border-primary text-black shadow-[0_20px_40px_rgba(var(--primary-rgb),0.2)]" : "bg-[#0a0f19]/40 border-white/5 text-gray-400 hover:border-white/20 hover:text-white"}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-xl transition-colors ${activeTab === tab.id ? "bg-black/10" : "bg-white/5 group-hover:bg-white/10"}`}
                  >
                    {tab.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest leading-none">
                      {tab.label}
                    </p>
                    <p
                      className={`text-[9px] mt-1 font-medium opacity-60 ${activeTab === tab.id ? "text-black" : "text-gray-500"}`}
                    >
                      {tab.desc}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-9">
            <div className="bg-[#0a0f19]/60 backdrop-blur-xl border border-white/10 rounded-[40px] shadow-2xl relative min-h-[600px]">
              <div className="p-8 lg:p-12">
                {activeTab === "profile" && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col sm:flex-row items-center gap-8 bg-white/[0.02] p-8 rounded-[32px] border border-white/5">
                      <div className="relative group">
                        <div className="w-32 h-32 rounded-[40px] overflow-hidden border-2 border-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]">
                          <img
                            src={
                              profileData.avatar ||
                              "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1000&auto=format&fit=crop"
                            }
                            alt="Bio-Scan"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button className="absolute -bottom-2 -right-2 bg-white text-black p-3 rounded-2xl shadow-xl hover:scale-110 transition-transform">
                          <Camera size={18} />
                        </button>
                      </div>
                      <div className="text-center sm:text-left">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter">
                          Identity Visual
                        </h3>
                        <p className="text-xs text-gray-500 max-w-[240px] uppercase tracking-widest leading-relaxed">
                          Neural node ID: {user?.id?.substring(0, 12)}...
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <InputGroup
                        label="First Name"
                        icon={<Hash size={12} />}
                        value={profileData.firstName}
                        onChange={(v) =>
                          setProfileData({ ...profileData, firstName: v })
                        }
                      />
                      <InputGroup
                        label="Last Name"
                        icon={<Hash size={12} />}
                        value={profileData.lastName}
                        onChange={(v) =>
                          setProfileData({ ...profileData, lastName: v })
                        }
                      />
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] flex items-center gap-2">
                          <Calendar size={12} className="text-primary" /> Date
                          of Birth
                        </label>
                        <input
                          type="date"
                          value={profileData.dob}
                          onChange={(e) =>
                            setProfileData({
                              ...profileData,
                              dob: e.target.value,
                            })
                          }
                          className="w-full bg-black/60 border border-white/10 rounded-[20px] py-4 px-6 focus:border-primary outline-none text-sm text-white"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] flex items-center gap-2">
                          <User size={12} className="text-primary" /> Gender
                          Identity
                        </label>
                        <select
                          value={profileData.gender}
                          onChange={(e) =>
                            setProfileData({
                              ...profileData,
                              gender: e.target.value,
                            })
                          }
                          className="w-full bg-black/60 border border-white/10 rounded-[20px] py-4 px-6 focus:border-primary outline-none text-sm font-bold uppercase text-white cursor-pointer appearance-none"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Non-binary">Non-binary</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "security" && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="space-y-2">
                      <h3 className="text-3xl font-black italic uppercase tracking-tighter">
                        Authentication Keys
                      </h3>
                      <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed">
                        Rotate neural access codes to maintain integrity.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-8 max-w-xl">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] flex items-center gap-2">
                          <Lock size={12} className="text-primary" /> Current
                          Code
                        </label>
                        <input
                          type="password"
                          value={securityData.oldPassword}
                          onChange={(e) =>
                            setSecurityData({
                              ...securityData,
                              oldPassword: e.target.value,
                            })
                          }
                          placeholder="••••••••••••"
                          className="w-full bg-black/40 border border-white/5 rounded-[20px] py-4 px-6 focus:border-primary transition-all outline-none text-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[9px] font-bold text-gray-500 uppercase">
                            New Signature
                          </label>
                          <input
                            type="password"
                            value={securityData.newPassword}
                            onChange={(e) =>
                              setSecurityData({
                                ...securityData,
                                newPassword: e.target.value,
                              })
                            }
                            className="w-full bg-black/40 border border-white/5 rounded-[20px] py-4 px-6 focus:border-primary outline-none text-white text-sm"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[9px] font-bold text-gray-500 uppercase">
                            Confirm Signature
                          </label>
                          <input
                            type="password"
                            value={securityData.confirmPassword}
                            onChange={(e) =>
                              setSecurityData({
                                ...securityData,
                                confirmPassword: e.target.value,
                              })
                            }
                            className="w-full bg-black/40 border border-white/5 rounded-[20px] py-4 px-6 focus:border-primary outline-none text-white text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "billing" && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter">
                      Data Tiers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        {
                          id: "free",
                          name: "Observer",
                          price: "$0",
                          icon: <Orbit size={20} />,
                          features: ["Standard Latency", "10GB Storage"],
                        },
                        {
                          id: "pro",
                          name: "Architect",
                          price: "$49",
                          icon: <Cpu size={20} />,
                          features: ["Low Latency Hub", "500GB Storage"],
                        },
                        {
                          id: "business",
                          name: "Overlord",
                          price: "$199",
                          icon: <Zap size={20} />,
                          features: ["Zero Latency", "Unlimited Storage"],
                        },
                      ].map((tier) => (
                        <div
                          key={tier.id}
                          onClick={() => setSelectedTier(tier.id)}
                          className={`relative p-6 rounded-[32px] border transition-all cursor-pointer ${selectedTier === tier.id ? "bg-white/5 border-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]" : "bg-black/20 border-white/5 hover:border-white/20"}`}
                        >
                          {selectedTier === tier.id && (
                            <div className="absolute top-4 right-4 text-primary animate-pulse">
                              <CheckCircle2 size={20} />
                            </div>
                          )}
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${selectedTier === tier.id ? "bg-primary text-black" : "bg-white/5 text-white"}`}
                          >
                            {tier.icon}
                          </div>
                          <p className="text-[10px] font-black uppercase text-gray-500">
                            {tier.name}
                          </p>
                          <p className="text-3xl font-black italic mt-1">
                            {tier.price}
                          </p>
                          <ul className="mt-6 space-y-3">
                            {tier.features.map((f, i) => (
                              <li
                                key={i}
                                className="text-[9px] uppercase tracking-widest text-gray-400 flex items-center gap-2"
                              >
                                <div className="w-1 h-1 bg-white/20 rounded-full" />{" "}
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <footer className="mt-12 pt-10 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),1)]" />
                    <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">
                      End-to-End Encryption Active
                    </p>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full sm:w-auto px-12 py-5 bg-primary text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 hover:shadow-[0_0_50px_rgba(var(--primary-rgb),0.4)] transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {isSaving
                      ? "Synchronizing..."
                      : activeTab === "billing"
                        ? "Confirm Tier Change"
                        : "Update Identity"}
                  </button>
                </footer>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

const InputGroup = ({
  label,
  value,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  icon: any;
  onChange: (v: string) => void;
}) => (
  <div className="space-y-3">
    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] flex items-center gap-2">
      <span className="text-primary">{icon}</span> {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-black/60 border border-white/10 rounded-[20px] py-4 px-6 focus:border-primary outline-none transition-all text-sm font-medium text-white"
    />
  </div>
);

export default SettingsPage;
