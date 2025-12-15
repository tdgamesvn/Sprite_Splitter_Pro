export interface GridSettings {
  rows: number;
  columns: number;
  imageWidth: number;
  imageHeight: number;
}

export interface FrameData {
  id: string;
  url: string; // Data URL
  index: number;
  width: number;
  height: number;
}

export interface UploadedImage {
  src: string;
  name: string;
  width: number;
  height: number;
}

export interface GradientStop {
  id: string;
  offset: number; // 0 to 100
  color: string; // Hex code
}

export interface ColorSettings {
  enabled: boolean;
  stops: GradientStop[];
}