export interface TextFieldConfig {
  x: number;
  y: number;
  rotation: number;
  color: string;
  fontSize: number;
}

export interface PresetConfig {
  nome: TextFieldConfig;
  idade: TextFieldConfig;
  baby: TextFieldConfig;
  fontSize: number;
  fontFamily: string;
  idadePosicao: "acima" | "abaixo";
  coordinateSpace?: "visual" | "pdf";
}

export const FONT_OPTIONS = [
  { value: "Porkys", label: "Baby Looney Tunes (Porkys)" },
  { value: "Arial", label: "Arial" },
  { value: "Calibri", label: "Calibri" },
  { value: "Cambria", label: "Cambria" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Comic Sans MS", label: "Comic Sans MS" },
  { value: "Impact", label: "Impact" },
  { value: "Courier New", label: "Courier New" },
];

export const defaultConfig: PresetConfig = {
  nome: { x: 210, y: 340, rotation: 0, color: "#0064ff", fontSize: 48 },
  idade: { x: 210, y: 300, rotation: 0, color: "#00a03c", fontSize: 34 },
  baby: { x: 210, y: 260, rotation: 0, color: "#ff69b4", fontSize: 29 },
  fontSize: 48,
  fontFamily: "Porkys",
  idadePosicao: "abaixo",
  coordinateSpace: "visual",
};
