// Decode with EXIF orientation applied so width/height match what the <img> displays.
// Then bake the orientation into a fresh dataURL so the stored bytes have no EXIF rotation.
export async function readImageFile(
  file: File,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("Could not decode image");
  });
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not decode image");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, mime === "image/jpeg" ? 0.92 : undefined);
  return { dataUrl, width, height };
}
