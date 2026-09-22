/**
 * Utility function to download files/images from URLs (including cross-origin Cloudinary URLs)
 * @param {string} url - The URL of the file to download
 * @param {string} defaultFileName - Fallback name for the downloaded file
 */
export const downloadFile = async (url, defaultFileName = "document") => {
  if (!url) return;

  try {
    // 1. If it's a Cloudinary URL, convert it to an attachment URL by adding fl_attachment
    let downloadUrl = url;
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      downloadUrl = url.replace('/upload/', '/upload/fl_attachment/');
    }

    // 2. Fetch as blob for instant direct browser download
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    // Determine extension from content-type or URL
    let extension = "";
    if (blob.type) {
      if (blob.type.includes("png")) extension = "png";
      else if (blob.type.includes("jpeg") || blob.type.includes("jpg")) extension = "jpg";
      else if (blob.type.includes("webp")) extension = "webp";
      else if (blob.type.includes("pdf")) extension = "pdf";
    }

    if (!extension) {
      const urlExt = url.split(".").pop().split("?")[0].toLowerCase();
      if (["png", "jpg", "jpeg", "webp", "pdf"].includes(urlExt)) {
        extension = urlExt;
      } else {
        extension = "png";
      }
    }

    let finalFileName = defaultFileName;
    if (!finalFileName.toLowerCase().endsWith(`.${extension}`)) {
      finalFileName = `${finalFileName}.${extension}`;
    }

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke blob URL after a short delay
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);
  } catch (error) {
    console.warn("Direct blob download failed, trying fallback:", error);
    // Fallback: If fetch is blocked by CORS, open direct attachment URL in new tab / window
    let fallbackUrl = url;
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      fallbackUrl = url.replace('/upload/', '/upload/fl_attachment/');
    }
    const link = document.createElement("a");
    link.href = fallbackUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.download = defaultFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
