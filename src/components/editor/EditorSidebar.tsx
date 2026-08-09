import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Move, Type, RotateCw, Palette, Lock } from "lucide-react";
import { PresetConfig, FONT_OPTIONS } from "./types";
import { useCustomFonts } from "@/hooks/use-custom-fonts";

interface EditorSidebarProps {
  config: PresetConfig;
  onConfigChange: (config: PresetConfig) => void;
}

const EditorSidebar = ({ config, onConfigChange }: EditorSidebarProps) => {
  const { data: customFonts } = useCustomFonts();

  const fontOptions = [
    ...FONT_OPTIONS,
    ...(customFonts || [])
      .filter((f) => !FONT_OPTIONS.some((o) => o.value === f.nome))
      .map((f) => ({ value: f.nome, label: `${f.nome} (enviada)` })),
  ];

  const update = (partial: Partial<PresetConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  const updateField = (field: "nome" | "idade" | "baby", partial: Partial<PresetConfig["nome"]>) => {
    onConfigChange({
      ...config,
      [field]: { ...config[field], ...partial },
    });
  };

  return (
    <div className="w-80 border-l border-border bg-card p-5 space-y-5 overflow-auto">
      <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Configurações</h3>

      {/* Font Family */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <Type className="w-3.5 h-3.5" /> Fonte
        </Label>
        <Select value={config.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontOptions.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                <span style={{ fontFamily: f.value }}>{f.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Posição da Idade */}
      <div className="space-y-2">
        <Label className="text-sm">Posição da Idade</Label>
        <Select
          value={config.idadePosicao}
          onValueChange={(v) => update({ idadePosicao: v as "acima" | "abaixo" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="acima">Acima do Nome</SelectItem>
            <SelectItem value="abaixo">Abaixo do Nome</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Baby Config (text is fixed) */}
      <FieldConfig
        label='Baby (texto fixo)'
        icon={<Lock className="w-3 h-3" />}
        color={config.baby.color}
        rotation={config.baby.rotation}
        fontSize={config.baby.fontSize}
        coords={{ x: config.baby.x, y: config.baby.y }}
        onColorChange={(c) => updateField("baby", { color: c })}
        onRotationChange={(r) => updateField("baby", { rotation: r })}
        onFontSizeChange={(s) => updateField("baby", { fontSize: s })}
        onCoordsChange={(coords) => updateField("baby", coords)}
      />

      <FieldConfig
        label="Nome"
        color={config.nome.color}
        rotation={config.nome.rotation}
        fontSize={config.nome.fontSize}
        coords={{ x: config.nome.x, y: config.nome.y }}
        onColorChange={(c) => updateField("nome", { color: c })}
        onRotationChange={(r) => updateField("nome", { rotation: r })}
        onFontSizeChange={(s) => updateField("nome", { fontSize: s })}
        onCoordsChange={(coords) => updateField("nome", coords)}
      />

      <FieldConfig
        label="Idade"
        color={config.idade.color}
        rotation={config.idade.rotation}
        fontSize={config.idade.fontSize}
        coords={{ x: config.idade.x, y: config.idade.y }}
        onColorChange={(c) => updateField("idade", { color: c })}
        onRotationChange={(r) => updateField("idade", { rotation: r })}
        onFontSizeChange={(s) => updateField("idade", { fontSize: s })}
        onCoordsChange={(coords) => updateField("idade", coords)}
      />

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          💡 Arraste os marcadores no canvas para posicionar. Tudo é salvo automaticamente.
        </p>
      </div>
    </div>
  );
};

interface FieldConfigProps {
  label: string;
  icon?: React.ReactNode;
  color: string;
  rotation: number;
  fontSize: number;
  coords: { x: number; y: number };
  onColorChange: (color: string) => void;
  onRotationChange: (rotation: number) => void;
  onFontSizeChange: (fontSize: number) => void;
  onCoordsChange: (coords: Partial<{ x: number; y: number }>) => void;
}

const FieldConfig = ({ label, icon, color, rotation, fontSize, coords, onColorChange, onRotationChange, onFontSizeChange, onCoordsChange }: FieldConfigProps) => (
  <div className="space-y-3 p-3 rounded-lg bg-muted">
    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
      {icon}
      {label}
    </h4>

    {/* Font Size */}
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Type className="w-3.5 h-3.5 text-muted-foreground" />
        <Label className="text-xs">Tamanho: {fontSize}px</Label>
      </div>
      <Slider
        value={[fontSize]}
        onValueChange={([v]) => onFontSizeChange(v)}
        min={12}
        max={200}
        step={1}
      />
    </div>

    {/* Color */}
    <div className="flex items-center gap-2">
      <Palette className="w-3.5 h-3.5 text-muted-foreground" />
      <Label className="text-xs w-8">Cor</Label>
      <input
        type="color"
        value={color}
        onChange={(e) => onColorChange(e.target.value)}
        className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
      />
      <span className="text-xs font-mono text-muted-foreground">{color}</span>
    </div>

    {/* Rotation */}
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
        <Label className="text-xs">Rotação: {rotation}°</Label>
      </div>
      <Slider
        value={[rotation]}
        onValueChange={([v]) => onRotationChange(v)}
        min={-180}
        max={180}
        step={1}
      />
    </div>

    {/* Coordinates */}
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Move className="w-3.5 h-3.5 text-muted-foreground" />
        <Label className="text-xs">Posição fina</Label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] font-medium uppercase text-muted-foreground">X</span>
          <Input
            type="number"
            value={coords.x}
            onChange={(event) => onCoordsChange({ x: Math.round(Number(event.target.value) || 0) })}
            className="h-8 font-mono text-xs"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium uppercase text-muted-foreground">Y</span>
          <Input
            type="number"
            value={coords.y}
            onChange={(event) => onCoordsChange({ y: Math.round(Number(event.target.value) || 0) })}
            className="h-8 font-mono text-xs"
          />
        </label>
      </div>
    </div>
  </div>
);

export default EditorSidebar;
