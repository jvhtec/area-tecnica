export class StampService {
  private static cachedExactSectorProStamp: StampImage | null | undefined = undefined;
  private static cachedFallbackSectorProStamp: StampImage | null = null;

  static async loadExactSectorProStamp(): Promise<StampImage | null> {
    if (this.cachedExactSectorProStamp !== undefined) return this.cachedExactSectorProStamp;
    if (typeof window === 'undefined') {
      this.cachedExactSectorProStamp = null;
      return null;
    }

    const possiblePaths = [
      '/stamps/sector-pro-stamp.png',
      '/stamps/sector_pro_stamp.png',
      '/sector-pro-stamp.png',
    ];

    for (const path of possiblePaths) {
      try {
        const response = await fetch(path);
        if (!response.ok) continue;
        const blob = await response.blob();
        const dataUrl = await this.blobToDataURL(blob);
        const { width, height } = await this.getImageDimensions(dataUrl);
        this.cachedExactSectorProStamp = { dataUrl, width, height };
        return this.cachedExactSectorProStamp;
      } catch {
        continue;
      }
    }

    this.cachedExactSectorProStamp = null;
    return null;
  }

  static async loadExactSectorProStampDataUrl(): Promise<string | null> {
    const stamp = await this.loadExactSectorProStamp();
    return stamp?.dataUrl ?? null;
  }

  static getFallbackSectorProStamp(): StampImage | null {
    if (this.cachedFallbackSectorProStamp) return this.cachedFallbackSectorProStamp;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 260;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const stampColor = '#1D4ED8'; // blue-ish
    const padding = 12;

    // Border
    ctx.strokeStyle = stampColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(
      padding,
      padding,
      canvas.width - padding * 2,
      canvas.height - padding * 2
    );

    // Text
    ctx.fillStyle = stampColor;
    ctx.textAlign = 'center';

    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.fillText('SECTOR-PRO', canvas.width / 2, 78);

    ctx.font = '24px Arial, sans-serif';
    ctx.fillText('Puerto Rico, 6', canvas.width / 2, 118);
    ctx.fillText('P.I. Las Naciones', canvas.width / 2, 148);
    ctx.fillText('28971 Griñón · Madrid', canvas.width / 2, 178);

    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('892 20 96 97', canvas.width / 2, 220);

    try {
      this.cachedFallbackSectorProStamp = {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      };
      return this.cachedFallbackSectorProStamp;
    } catch {
      return null;
    }
  }

  static getFallbackSectorProStampDataUrl(): string | null {
    return this.getFallbackSectorProStamp()?.dataUrl ?? null;
  }

  private static blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private static getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      };
      img.onerror = () => reject(new Error('Failed to load image for dimension check'));
      img.src = dataUrl;
    });
  }
}

export type StampImage = {
  dataUrl: string;
  width: number;
  height: number;
};
