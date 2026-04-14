"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Image, Mic, Upload, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@ui";
import { avatarsApi, type Avatar } from "@/api/avatars";
import { toast } from "react-hot-toast";

const PHOTOS_REQUIRED = 21;
const VOICE_REQUIRED = 10;

export default function LabPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const avatarId = searchParams.get("avatarId");

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [voiceFiles, setVoiceFiles] = useState<File[]>([]);

  const loadAvatar = useCallback(async () => {
    if (!avatarId) return;
    try {
      const res = await avatarsApi.getOne(avatarId);
      if (res?.data?.avatar) setAvatar(res.data.avatar);
    } catch (e) {
      toast.error("Avatar not found");
      router.push("/avatars");
    } finally {
      setLoading(false);
    }
  }, [avatarId, router]);

  useEffect(() => {
    if (!avatarId) {
      setLoading(false);
      return;
    }
    loadAvatar();
  }, [avatarId, loadAvatar]);

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles((prev) => [...prev, ...files].slice(0, PHOTOS_REQUIRED));
  };

  const onVoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setVoiceFiles((prev) => [...prev, ...files].slice(0, VOICE_REQUIRED));
  };

  const removePhoto = (i: number) => setPhotoFiles((p) => p.filter((_, j) => j !== i));
  const removeVoice = (i: number) => setVoiceFiles((p) => p.filter((_, j) => j !== i));

  const handleUpload = async () => {
    if (!avatarId || !avatar) return;
    const photosToSend = photoFiles.slice(0, PHOTOS_REQUIRED);
    const voiceToSend = voiceFiles.slice(0, VOICE_REQUIRED);
    if (photosToSend.length === 0 && voiceToSend.length === 0) {
      toast.error("Add at least one photo or voice sample");
      return;
    }
    setUploading(true);
    try {
      const res = await avatarsApi.upload(avatarId, {
        photos: photosToSend.length ? photosToSend : undefined,
        voiceSamples: voiceToSend.length ? voiceToSend : undefined,
      });
      toast.success(`Uploaded. Photos: ${res?.data?.counts?.photos ?? 0}, Voice: ${res?.data?.counts?.voiceSamples ?? 0}`);
      if (res?.data?.avatar) setAvatar(res.data.avatar);
      setPhotoFiles([]);
      setVoiceFiles([]);
      loadAvatar();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!avatarId) {
    return (
      <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-10">
        <p className="text-gray-400">No avatar selected. <Link href="/avatars" className="text-primary underline">Choose an avatar</Link> and click Setup.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-10">
        <div className="animate-pulse h-64 bg-[#0a0f19] rounded-xl" />
      </div>
    );
  }

  if (!avatar) return null;

  const photoCount = avatar.photoUrls?.length || 0;
  const voiceCount = avatar.voiceSampleUrls?.length || 0;
  const photosOk = photoCount >= PHOTOS_REQUIRED;
  const voiceOk = voiceCount >= VOICE_REQUIRED;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-10">
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <Link href="/avatars" className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">The Lab</h1>
            <p className="text-gray-500 text-sm">{avatar.name} – upload assets for training</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Photos */}
        <div className="bg-[#0a0f19] border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Image size={20} />
              Photos ({photoCount}/{PHOTOS_REQUIRED})
            </h2>
            {photosOk && <CheckCircle2 className="text-green-500" size={24} />}
          </div>
          <p className="text-sm text-gray-400 mb-4">Upload 21 photos for visual training.</p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onPhotoChange}
            className="hidden"
            id="photo-upload"
          />
          <label htmlFor="photo-upload" className="block">
            <div className="border border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="mx-auto text-gray-500 mb-2" size={32} />
              <span className="text-sm text-gray-400">Click or drop images</span>
            </div>
          </label>
          {photoFiles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {photoFiles.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 bg-white/5 rounded px-2 py-1 text-xs"
                >
                  {f.name.slice(0, 20)}
                  <button type="button" onClick={() => removePhoto(i)} className="text-red-400">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Voice samples */}
        <div className="bg-[#0a0f19] border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Mic size={20} />
              Voice samples ({voiceCount}/{VOICE_REQUIRED})
            </h2>
            {voiceOk && <CheckCircle2 className="text-green-500" size={24} />}
          </div>
          <p className="text-sm text-gray-400 mb-4">Upload 10 voice samples (mp3 or wav) for cloning.</p>
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/*"
            multiple
            onChange={onVoiceChange}
            className="hidden"
            id="voice-upload"
          />
          <label htmlFor="voice-upload" className="block">
            <div className="border border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="mx-auto text-gray-500 mb-2" size={32} />
              <span className="text-sm text-gray-400">Click or drop audio files</span>
            </div>
          </label>
          {voiceFiles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {voiceFiles.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 bg-white/5 rounded px-2 py-1 text-xs"
                >
                  {f.name.slice(0, 20)}
                  <button type="button" onClick={() => removeVoice(i)} className="text-red-400">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          text={uploading ? "Uploading..." : "Upload to Avatar"}
          onClick={handleUpload}
          disable={uploading || (photoFiles.length === 0 && voiceFiles.length === 0)}
          icon={uploading ? undefined : <Upload size={18} />}
          focusOn={true}
        />
      </div>
    </div>
  );
}
