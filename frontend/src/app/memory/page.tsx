"use client";
import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Database,
  ShieldCheck,
  Zap,
  Plus,
  Terminal,
  Loader2,
  Users,
} from "lucide-react";
import { getVault, addMemory, deleteMemoryFile, VaultData } from "@/api/memory";
import { listAvatars, Avatar } from "@/api/avatars"; // Import avatar list
import { toast } from "react-hot-toast";

const MemoryVault: React.FC = () => {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [neuralBio, setNeuralBio] = useState("");

  const loadAllData = async () => {
    try {
      const [vaultData, avatarData] = await Promise.all([
        getVault(),
        listAvatars(),
      ]);
      setVault(vaultData);
      setAvatars(avatarData);
      if (vaultData.neuralBio) setNeuralBio(vaultData.neuralBio);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await addMemory({ file, avatarId: selectedAvatarId });
      await loadAllData();
      toast.success("Memory injected into neural core");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to purge this memory fragment?"))
      return;
    await deleteMemoryFile(fileId);
    await loadAllData();
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#020202] text-white p-6 lg:p-12 selection:bg-primary/30">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        <div className="flex items-center gap-3">
          <Database className="text-primary" size={28} />
          <h1 className="text-4xl font-black uppercase">
            Memory <span className="text-primary">Vault</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* AVATAR PICKER */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2 rounded-xl">
            <Users size={16} className="text-primary ml-2" />
            <select
              value={selectedAvatarId}
              onChange={(e) => setSelectedAvatarId(e.target.value)}
              className="bg-transparent text-[10px] font-bold uppercase tracking-widest outline-none pr-4"
            >
              <option value="">Global Memory</option>
              {avatars.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <div className="flex items-center gap-2 px-8 py-3 bg-primary text-black rounded-xl font-black uppercase text-xs">
              {isUploading ? <RefreshCw className="animate-spin" /> : <Plus />}
              {isUploading ? "Injecting..." : "Inject Memory"}
            </div>
          </label>
        </div>
      </header>

      {/* RE-INDEX BIO SECTION */}
      <div className="mb-12 bg-[#0a0f19] border border-white/5 p-8 rounded-3xl">
        <div className="flex justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Terminal size={14} /> Neural Baseline
          </h3>
          <button
            onClick={() => addMemory({ neuralBio }).then(loadAllData)}
            className="text-[10px] font-bold text-white/40 hover:text-primary"
          >
            Sync Bio
          </button>
        </div>
        <textarea
          value={neuralBio}
          onChange={(e) => setNeuralBio(e.target.value)}
          className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-sm h-24 resize-none outline-none focus:border-primary/40"
        />
      </div>

      {/* FILE TABLE */}
      <div className="bg-[#0a0f19] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase tracking-[0.2em] border-b border-white/5 bg-black/20">
              <th className="px-8 py-5">Source</th>
              <th className="px-8 py-5">Avatar Scope</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {vault?.files.map((file: any) => (
              <tr key={file._id} className="hover:bg-primary/[0.02] group">
                <td className="px-8 py-6 flex items-center gap-4">
                  <FileText
                    className="text-gray-400 group-hover:text-primary"
                    size={20}
                  />
                  <div>
                    <p className="text-sm font-bold">{file.fileName}</p>
                    <p className="text-[9px] text-gray-600 font-mono uppercase">
                      {new Date(file.uploadDate).toDateString()}
                    </p>
                  </div>
                </td>
                <td className="px-8 py-6 text-[10px] font-mono text-white/40 uppercase">
                  {avatars.find((a) => a._id === file.avatarId)?.name ||
                    "Global"}
                </td>
                <td className="px-8 py-6">
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${file.isIndexed ? "text-primary bg-primary/5" : "text-yellow-500 bg-yellow-500/5"}`}
                  >
                    {file.isIndexed ? "Synced" : "Indexing"}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <button
                    onClick={() => handleDelete(file._id)}
                    className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MemoryVault;
