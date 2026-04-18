"use client";
import React, { useState } from "react";
import {
  Check,
  User,
  CreditCard,
  Camera,
  Globe,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/app/Redux/store";
import { onboardUserSubmit } from "@/api/auth";
import { toast } from "react-hot-toast";
import { AnimatePresence } from "framer-motion";
import { motion } from "framer-motion";

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

  const canProceed = () => {
    return (
      formData.firstName.trim() !== "" &&
      formData.lastName.trim() !== "" &&
      formData.gender !== "" &&
      formData.dob !== ""
    );
  };

  const handleNext = () => {
    if (!canProceed()) {
      toast.error("Please fill in your basic details first.");
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const data = await onboardUserSubmit(formData, dispatch);
      if (data) {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Onboarding Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-slate-300 flex flex-col items-center py-10 px-4 md:py-20">
      {/* Simplified Progress Tracker */}
      <div className="w-full max-w-lg mb-12 flex justify-between relative px-6">
        <div className="absolute top-5 left-0 w-full h-[1px] bg-white/10" />
        {[1, 2].map((s) => (
          <div key={s} className="relative z-10 flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                currentStep >= s
                  ? "border-primary bg-primary text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                  : "border-white/10 bg-[#050505] text-white/20"
              }`}
            >
              {s === 1 ? <User size={18} /> : <CreditCard size={18} />}
            </div>
            <span
              className={`text-[10px] font-black uppercase tracking-widest mt-3 ${currentStep >= s ? "text-primary" : "text-white/20"}`}
            >
              {s === 1 ? "Your Info" : "Choose Plan"}
            </span>
          </div>
        ))}
      </div>

      {/* Main Content Card */}
      <div className="w-full max-w-2xl bg-[#0d0d12] border border-white/10 rounded-[8px] p-6 md:p-10 shadow-2xl overflow-hidden">
        <AnimatePresence mode="wait">
          {currentStep === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <header className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Basic Details
                </h2>
                <p className="text-gray-500 text-sm">
                  Tell us a bit about yourself to get started.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    First Name
                  </label>
                  <input
                    value={formData.firstName}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-[8px] text-sm text-white focus:border-primary/50 outline-none transition-all"
                    placeholder="e.g. John"
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Last Name
                  </label>
                  <input
                    value={formData.lastName}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-[8px] text-sm text-white focus:border-primary/50 outline-none transition-all"
                    placeholder="e.g. Doe"
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-[8px] text-sm text-white focus:border-primary/50 outline-none appearance-none cursor-pointer"
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                  >
                    <option value="" className="bg-[#0d0d12]">
                      Select Option
                    </option>
                    <option value="male" className="bg-[#0d0d12]">
                      Male
                    </option>
                    <option value="female" className="bg-[#0d0d12]">
                      Female
                    </option>
                    <option value="non-binary" className="bg-[#0d0d12]">
                      Other
                    </option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Birthday
                  </label>
                  <input
                    type="date"
                    value={formData.dob}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-[8px] text-sm text-white focus:border-primary/50 outline-none transition-all"
                    onChange={(e) =>
                      setFormData({ ...formData, dob: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Globe size={14} className="text-primary" /> Region
                </label>
                <select
                  value={formData.region}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-[8px] text-sm text-white focus:border-primary/50 outline-none cursor-pointer"
                  onChange={(e) =>
                    setFormData({ ...formData, region: e.target.value })
                  }
                >
                  <option value="us" className="bg-[#0d0d12]">
                    United States
                  </option>
                  <option value="uk" className="bg-[#0d0d12]">
                    United Kingdom
                  </option>
                  <option value="au" className="bg-[#0d0d12]">
                    Australia
                  </option>
                  <option value="pk" className="bg-[#0d0d12]">
                    Pakistan
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider text-primary">
                  Your AI Bio
                </label>
                <textarea
                  value={formData.bio}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-[8px] text-sm text-white focus:border-primary/50 outline-none h-32 resize-none transition-all"
                  placeholder="Tell us about the personality you want your AI to have..."
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Pick a Plan
                </h2>
                <p className="text-gray-500 text-sm">
                  Choose the tier that fits your needs.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    id: "free",
                    name: "Free",
                    price: "$0",
                    desc: "For Hobbyists",
                    features: ["1 AI Avatar", "100 Credits"],
                  },
                  {
                    id: "pro",
                    name: "Pro",
                    price: "$49",
                    desc: "For Creators",
                    features: ["5 AI Avatars", "1k Credits", "HD Voice"],
                  },
                  {
                    id: "business",
                    name: "Elite",
                    price: "$199",
                    desc: "For Pros",
                    features: ["Unlimited", "Priority Rendering"],
                  },
                ].map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() =>
                      setFormData({ ...formData, subscriptionTier: plan.id })
                    }
                    className={`p-6 rounded-[8px] border-2 transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden ${
                      formData.subscriptionTier === plan.id
                        ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]"
                        : "border-white/5 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    {formData.subscriptionTier === plan.id && (
                      <div className="absolute top-2 right-2 text-primary">
                        <Check size={16} strokeWidth={4} />
                      </div>
                    )}
                    <h3 className="font-bold text-white">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">
                        {plan.price}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase">
                        /mo
                      </span>
                    </div>
                    <ul className="space-y-2 mt-2">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="text-[10px] text-gray-400 flex items-center gap-2"
                        >
                          <div className="w-1 h-1 bg-primary rounded-full" />{" "}
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Actions */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <button
            onClick={() => currentStep === 2 && setCurrentStep(1)}
            className={`text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all ${currentStep === 1 ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          >
            ← Go Back
          </button>

          <button
            onClick={currentStep === 1 ? handleNext : handleComplete}
            disabled={loading}
            className="w-full md:w-auto bg-primary text-black px-12 py-4 rounded-[8px] font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <>
                {currentStep === 1 ? "Next Step" : "Complete Setup"}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      <p className="mt-8 text-[10px] text-gray-600 uppercase tracking-widest font-medium">
        Secure Handshake · ArkLife Neural OS v4.0
      </p>
    </main>
  );
};

export default OnboardingPage;
