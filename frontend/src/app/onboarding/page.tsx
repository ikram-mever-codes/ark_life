"use client";
import React, { useState } from "react";
import { Check, User, CreditCard, Camera, Globe } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/app/Redux/store";
import { onboardUserSubmit } from "@/api/auth";
import { toast } from "react-hot-toast";

const OnboardingPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user } = useSelector((state: RootState) => state.user);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    gender: "",
    dob: "",
    region: "us",
    bio: "",
    subscriptionTier: "free",
  });

  // Validation for Step 1
  const canProceed = () => {
    return (
      formData.firstName.trim() !== "" &&
      formData.lastName.trim() !== "" &&
      formData.gender !== "" &&
      formData.dob !== ""
    );
  };

  const handleNextProtocol = () => {
    if (!canProceed()) {
      toast.error("Please complete all identity fields.");
      return;
    }
    setCurrentStep(2);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const data = await onboardUserSubmit(formData, dispatch);
      if (data) {
        // Redirecting to dashboard; AuthProvider will now allow access
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Onboarding Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-10 px-4 font-sans">
      {/* Progress Tracker */}
      <div className="w-full max-w-2xl mb-12 flex justify-between relative">
        <div className="absolute top-5 left-0 w-full h-[1px] bg-white/10 -z-0" />
        {[1, 2].map((s) => (
          <div
            key={s}
            className="relative z-10 flex flex-col items-center bg-[#050505] px-4"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${currentStep >= s ? "border-primary bg-primary text-black" : "border-white/20 text-white/40"}`}
            >
              {s === 1 ? <User size={18} /> : <CreditCard size={18} />}
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] mt-3 font-bold text-white/50">
              {s === 1 ? "Identity" : "Sub-Level"}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-3xl border border-white/10 rounded-xl p-8 shadow-2xl bg-[#0a0a0a]">
        {currentStep === 1 ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-primary italic">
                Step 01: Neural Baseline
              </h2>
              <p className="text-white/40 text-xs uppercase tracking-widest mt-1">
                Configure your digital representation
              </p>
            </header>

            {/* Avatar Section */}
            <div className="flex items-center gap-6 p-4 bg-white/5 rounded-lg border border-white/5">
              <div className="relative group w-20 h-20 shrink-0">
                <div className="w-full h-full rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center group-hover:border-primary transition-all cursor-pointer">
                  <Camera size={24} className="text-primary/70" />
                  <input
                    type="file"
                    className="hidden"
                    id="avatar-input"
                    accept="image/*"
                  />
                  <label
                    htmlFor="avatar-input"
                    className="absolute inset-0 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-tight">
                  Avatar Synthesis
                </h4>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Upload a clear front-facing photo to seed the visual engine.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase ml-1">
                  First Name
                </label>
                <input
                  value={formData.firstName}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded text-sm focus:border-primary outline-none transition-all"
                  placeholder="Enter first name"
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase ml-1">
                  Last Name
                </label>
                <input
                  value={formData.lastName}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded text-sm focus:border-primary outline-none transition-all"
                  placeholder="Enter last name"
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase ml-1">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded text-sm focus:border-primary outline-none appearance-none"
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value })
                  }
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-Binary</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase ml-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded text-sm focus:border-primary outline-none"
                  onChange={(e) =>
                    setFormData({ ...formData, dob: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-white/30 uppercase ml-1 flex items-center gap-2">
                <Globe size={10} /> Regional Accent Calibration
              </label>
              <select
                value={formData.region}
                className="w-full bg-white/5 border border-white/10 p-3 rounded text-sm focus:border-primary outline-none"
                onChange={(e) =>
                  setFormData({ ...formData, region: e.target.value })
                }
              >
                <option value="us">United States (Default)</option>
                <option value="uk">United Kingdom</option>
                <option value="au">Australia</option>
                <option value="pk">Pakistan</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-white/30 uppercase ml-1">
                Identity Context (LLM Seed Bio)
              </label>
              <textarea
                value={formData.bio}
                className="w-full bg-white/5 border border-white/10 p-3 rounded text-sm focus:border-primary outline-none h-24 resize-none"
                placeholder="Explain the role or personality of this avatar..."
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
            <header>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-primary italic">
                Step 02: Access Tier
              </h2>
              <p className="text-white/40 text-xs uppercase tracking-widest mt-1">
                Select your processing resource limit
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: "free",
                  name: "Free",
                  price: "$0",
                  desc: "Basic cloning",
                  features: ["1 Avatar", "100 Credits", "Standard Voice"],
                },
                {
                  id: "pro",
                  name: "Pro",
                  price: "$49",
                  desc: "Advanced synthesis",
                  features: [
                    "5 Avatars",
                    "1000 Credits",
                    "HD Voice",
                    "4K Video",
                  ],
                },
                {
                  id: "business",
                  name: "Business",
                  price: "$199",
                  desc: "Full autonomy",
                  features: [
                    "Unlimited",
                    "Priority GPU",
                    "API Access",
                    "Custom Training",
                  ],
                },
              ].map((plan) => (
                <div
                  key={plan.id}
                  onClick={() =>
                    setFormData({ ...formData, subscriptionTier: plan.id })
                  }
                  className={`p-5 rounded-lg border transition-all cursor-pointer flex flex-col ${formData.subscriptionTier === plan.id ? "border-primary bg-primary/5 ring-1 ring-primary/50" : "border-white/10 bg-white/5 hover:border-white/30"}`}
                >
                  <span className="text-[10px] font-black uppercase text-white/40 mb-1">
                    {plan.desc}
                  </span>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <div className="my-4">
                    <span className="text-2xl font-black">{plan.price}</span>
                    <span className="text-[10px] text-white/30">/mo</span>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="text-[10px] text-white/60 flex items-center gap-2"
                      >
                        <Check size={10} className="text-primary" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-white/5 pt-6">
          <button
            onClick={() => currentStep === 2 && setCurrentStep(1)}
            className={`text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all ${currentStep === 1 ? "invisible" : ""}`}
          >
            Back
          </button>
          <button
            onClick={currentStep === 1 ? handleNextProtocol : handleComplete}
            disabled={loading}
            className="bg-primary text-black px-10 py-3 rounded font-black text-[11px] uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : currentStep === 1
                ? "Next Protocol"
                : "Authorize Sync"}
          </button>
        </div>
      </div>
    </main>
  );
};

export default OnboardingPage;
