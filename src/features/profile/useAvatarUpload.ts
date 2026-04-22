import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/**
 * Canonical React Native Supabase avatar upload pipeline
 * (pick → resize → base64 → ArrayBuffer → Storage → DB path).
 *
 * Uses the base64-arraybuffer path rather than the native `Blob` constructor
 * because RN's Blob implementation silently produces 0-byte files when
 * uploaded to Supabase Storage (see 01-RESEARCH.md Pitfall, line 597).
 */
export async function pickAndUploadAvatar(
  userId: string,
): Promise<string | null> {
  const pick = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (pick.canceled) return null;

  const resized = await ImageManipulator.manipulateAsync(
    pick.assets[0].uri,
    [{ resize: { width: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: 'base64',
  });
  const buf = decode(base64);

  const path = `${userId}/avatar.jpg`;
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;

  const { error: dbErr } = await supabase
    .from('profiles')
    .update({ avatar_path: path, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (dbErr) throw dbErr;

  return path;
}

export function useAvatarUpload(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pickAndUploadAvatar(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}
