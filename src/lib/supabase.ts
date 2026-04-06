import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Solo para uso server-side (API routes, Server Components)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadFile(
  file: File | Buffer,
  bucket: string,
  path: string,
  contentType?: string
): Promise<string> {
  const body = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
  const ct = contentType ?? (file instanceof File ? file.type : "application/octet-stream");

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, body, { contentType: ct, upsert: true });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);

  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Error eliminando archivo: ${error.message}`);
}
