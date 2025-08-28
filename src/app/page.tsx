"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner"
// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// ====== Utilidades ======
function useDebounce<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ====== Dominio / Cálculos ======
const calc = (inp: FormValues): Outputs => {
const { plumaAzul, plumaRoja, diametroPlaca, diametroPuente, temperaturac, gravgas, fb, fpv, relacionCalorEspecifico, medidorRangoEstatico, medidorRangoDiferencial } = inp;

  const safe = (n: number) => (Number.isFinite(n) ? n : 0);

  const betaD = diametroPuente > 0 ? diametroPlaca / diametroPuente : 0;
  const b = diametroPuente > 0 ? 530 / Math.sqrt(diametroPuente) : 0;
  const polinomio = 830 - 5000 * betaD + 9000 * betaD ** 2 - 4200 * betaD ** 3 + b;
  const e = diametroPlaca * polinomio;
  const k = 0.647;

  const pfipca = (medidorRangoEstatico * diametroPlaca) / 100 * 14.2233;
  const hw = (medidorRangoDiferencial * diametroPuente) / 100;

  const x = pfipca > 0 ? hw / (27.7 * pfipca) : 0;

  const raiz = Math.sqrt(1 + x);
  const numerador = (0.41 + 0.35 * relacionCalorEspecifico ** 4) * x;
  const y = betaD > 0 ? safe(raiz - numerador / (betaD * raiz)) : 0;

  const be = k > 0 && diametroPlaca > 0 ? e / (12835 * k * diametroPlaca) : 0;
  const fr = pfipca > 0 && hw > 0 ? 1 + be / Math.sqrt(pfipca * hw) : 0;

  const temperaturaf = (9 / 5) * temperaturac + 32;
  const ftf = Math.sqrt(520 / (460 + temperaturaf));
  const fg = gravgas > 0 ? Math.sqrt(1 / gravgas) : 0;

  const cHora = fb * fpv * ftf * fg * fr * y;

  const factorCorreccion =
    cHora * 24 / 35.31 * Math.sqrt(14.2233 * medidorRangoDiferencial * medidorRangoEstatico / 10000);

  const caudaldegas = Math.sqrt(plumaAzul * plumaRoja) * factorCorreccion;

  return {
    betaD,
    b,
    e,
    k,
    pfipca,
    hw,
    x,
    y,
    be,
    fr,
    temperaturaf,
    ftf,
    fg,
    cHora,
    factorCorreccion,
    caudaldegas,
  } satisfies Outputs;
};

// ====== Tipos y validación (Zod v4) ======
const schema = z.object({
  plumaAzul: z.coerce.number(),
  plumaRoja: z.coerce.number(),
  diametroPlaca: z.coerce.number(),
  diametroPuente: z.coerce.number(),
  medidorRangoEstatico: z.coerce.number(),
  medidorRangoDiferencial: z.coerce.number(),
  temperaturac: z.coerce.number(),
  gravgas: z.coerce.number(),
  fb: z.coerce.number(),
  fpv: z.coerce.number(),
  relacionCalorEspecifico: z.coerce.number(),
});


// Tipos derivados para RHF con Zod 4
type FormValues = z.infer<typeof schema>;  // ✅ todos son number
// valores parseados por Zod

export type Outputs = {
  betaD: number;
  b: number;
  e: number;
  k: number;
  pfipca: number;
  hw: number;
  x: number;
  y: number;
  be: number;
  fr: number;
  temperaturaf: number;
  ftf: number;
  fg: number;
  cHora: number;
  factorCorreccion: number;
  caudaldegas: number;
};

// ====== Presets ======
const PRESETS: Record<string, Partial<FormValues>> = {
  "Gas típico": { gravgas: 0.65, relacionCalorEspecifico: 1.31, fpv: 1.02 },
  "Gas asociado húmedo": { gravgas: 0.75, relacionCalorEspecifico: 1.28, fpv: 1.015 },
  "Gas seco": { gravgas: 0.60, relacionCalorEspecifico: 1.33, fpv: 1.025 },
  "Gas PM-08": { gravgas: 0.6631, relacionCalorEspecifico: 1.3, fpv: 1.0212752 },
  "Gas C-109": { gravgas: 0.6631, relacionCalorEspecifico: 1.33, fpv: 1.02196342 },
};

const DEFAULTS = {
  plumaAzul: 0,
  plumaRoja: 0,
  diametroPlaca: 0,
  diametroPuente: 0,
  medidorRangoEstatico: 0,
  medidorRangoDiferencial: 0,
  temperaturac: 0,
  gravgas: 1,
  fb: 674.44,
  fpv: 1.02196342,
  relacionCalorEspecifico: 1.3,
};

const LS_KEY = "calcgas:v1:inputs";

export default function CalculadoraDeGasAvanzada() {

  const [autoCalc, setAutoCalc] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>("-");
  const mountedRef = useRef(false);

const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: {
    plumaAzul: 0,
    plumaRoja: 0,
    diametroPlaca: 0,
    diametroPuente: 0,
    medidorRangoEstatico: 0,
    medidorRangoDiferencial: 0,
    temperaturac: 0,
    gravgas: 1,
    fb: 674.44,
    fpv: 1.02196342,
    relacionCalorEspecifico: 1.3,
  },
});


  // Hydrate desde localStorage
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) ;
        form.reset({ ...DEFAULTS, ...parsed });
      } catch (_) {}
    }
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistencia en localStorage (debounced)
  const watchAll = form.watch();
  const debouncedWatch = useDebounce(watchAll, 400);
  useEffect(() => {
    if (!mountedRef.current) return;
    localStorage.setItem(LS_KEY, JSON.stringify(debouncedWatch));
  }, [debouncedWatch]);

  // Cálculo
  const [outputs, setOutputs] = useState<Outputs | null>(null);
  const debouncedInputs = useDebounce(watchAll, 400) ;
  const autoOutputs = useMemo(() => calc(debouncedInputs), [debouncedInputs]);

  useEffect(() => {
    if (autoCalc) setOutputs(autoOutputs);
  }, [autoCalc, autoOutputs]);

  const onSubmit = (data: FormValues) => {
    const o = calc(data);
    setOutputs(o);
    toast.success("Resultados recalculados con los datos ingresados.");
  };

  // Aplicar preset
  const applyPreset = (key: string) => {
    setSelectedPreset(key);
    if (key === "-") return;
    const p = PRESETS[key];
    form.reset({ ...form.getValues(), ...p });
  toast.success("Preset aplicado");};

  const o = outputs;

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full grid place-items-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl grid gap-6"
        >
          <div className="flex items-center justify-between">
            <img src={"./LOGOHORIZONTAL.png"} className="w-1/4"></img>
            <h1 className="text-2xl sm:text-3xl font-bold">Calculadora de Gas (Venoil energia)</h1>
            <div className="flex items-center gap-3">
              <Label htmlFor="autocalc" className="text-sm">Auto calcular</Label>
              <Switch id="autocalc" checked={autoCalc} onCheckedChange={setAutoCalc} />
            </div>
          </div>

          {/* Cromatografia */}
          <div className="flex items-center gap-3">
            <Label className="w-32">Cromatografía</Label>
            <Select value={selectedPreset} onValueChange={applyPreset}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Elegir preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-">Sin cromatografía elegida</SelectItem>
                {Object.keys(PRESETS).map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Variables de proceso</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Pluma Azul" unit="-" form={form} name="plumaAzul" />
                <Field label="Pluma Roja" unit="-" form={form} name="plumaRoja" />
                <Field label="Diám. Placa" unit="in" form={form} name="diametroPlaca" />
                <Field label="Diám. Puente" unit="in" form={form} name="diametroPuente" />
                <Field label="Rango Estático" unit="%" form={form} name="medidorRangoEstatico" />
                <Field label="Rango Diferencial" unit="%" form={form} name="medidorRangoDiferencial" />
                <Field label="Temperatura" unit="°C" form={form} name="temperaturac" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Propiedades del gas y factores</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Gravedad del gas γ" unit="-" form={form} name="gravgas" tooltip="Relativa al aire (≈1)." />
                <Field label="FPV" unit="-" form={form} name="fpv" tooltip="Factor de compresibilidad." />
                <Field label="FB" unit="-" form={form} name="fb" tooltip="Constante base del medidor." />
                <Field label="k (γ de calores)" unit="-" form={form} name="relacionCalorEspecifico" tooltip="Relación de calores específicos (k)." />

                {!autoCalc && (
                  <div className="col-span-2 pt-2 flex gap-2">
                    <Button type="submit" className="w-full">Calcular</Button>
                    <Button type="button" variant="secondary" onClick={() => { form.reset(DEFAULTS); toast.error("Enviado")}}>Reset</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Resultado</CardTitle>
              </CardHeader>
              <CardContent>
                {o ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Kpi title="Caudal de gas" value={fmt(o.caudaldegas, 3)} suffix=" (unid.)" />
                    <Kpi title="CHora" value={fmt(o.cHora, 5)} />
                    <Kpi title="Factor Corrección" value={fmt(o.factorCorreccion, 5)} />
                  </div>
                ) : (
                  <p className="text-muted-foreground">Aún no hay resultados. Complete el formulario y calcule.</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cálculos intermedios (auditoría)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <Tag label="β" value={o?.betaD} />
                <Tag label="y" value={o?.y} />
                <Tag label="FTF" value={o?.ftf} />
                <Tag label="FG" value={o?.fg} />
                <Tag label="FR" value={o?.fr} />
                <Tag label="PFIPCA" value={o?.pfipca} />
                <Tag label="HW" value={o?.hw} />
                <Tag label="x" value={o?.x} />
                <Tag label="b" value={o?.b} />
                <Tag label="e" value={o?.e} />
                <Tag label="k" value={o?.k} />
                <Tag label="Temp (°F)" value={o?.temperaturaf} />
              </CardContent>
            </Card>
          </form>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}

// ====== Subcomponentes ======
function Field({ label, unit, name, form, tooltip }: {
  label: string;
  unit?: string;
  name: keyof FormValues;
  form: ReturnType<typeof useForm<FormValues>>;
  tooltip?: string;
}) {
  const { register, formState: { errors } } = form;
  const err = (errors)[name]?.message as string | undefined;

  const input = (
    <div className="flex items-center gap-2">
      <Input type="number" step="any" {...register(name)} />
      {unit && <div className="text-sm text-muted-foreground w-10 text-right">{unit}</div>}
    </div>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs px-2 py-0.5 rounded bg-muted cursor-help">i</span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {input}
      {err && <span className="text-sm text-destructive">{err}</span>}
    </div>
  );
}

function Kpi({ title, value, suffix = "" }: { title: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold tracking-tight">{value}{suffix}</div>
    </div>
  );
}

function Tag({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border px-3 py-2 flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value !== undefined ? fmt(value, 5) : "-"}</span>
    </div>
  );
}

function fmt(n: number, digits = 3) {
  if (!Number.isFinite(n)) return "-";
  return Number(n).toFixed(digits);
}