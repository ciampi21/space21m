import { useState, useRef, useCallback } from "react";
import { Lock, Unlock, Upload, Download, Eye, EyeOff, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ──────────────────────────────────────────────────────────────────

type Status = "idle" | "processing" | "done" | "error";

interface TabState {
  file: File | null;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirm: boolean;
  status: Status;
  errorMsg: string;
  downloadUrl: string;
  downloadName: string;
}

const defaultTabState = (): TabState => ({
  file: null,
  password: "",
  confirmPassword: "",
  showPassword: false,
  showConfirm: false,
  status: "idle",
  errorMsg: "",
  downloadUrl: "",
  downloadName: "",
});

// ─── Upload Area ─────────────────────────────────────────────────────────────

interface UploadAreaProps {
  file: File | null;
  onFile: (f: File) => void;
}

const UploadArea = ({ file, onFile }: UploadAreaProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped && dropped.type === "application/pdf") onFile(dropped);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
        p-8 cursor-pointer transition-colors duration-200
        ${dragging
          ? "border-primary bg-primary/5"
          : file
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      {file ? (
        <>
          <FileText className="w-10 h-10 text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Clique para trocar o arquivo</p>
        </>
      ) : (
        <>
          <Upload className="w-10 h-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Arraste um PDF aqui</p>
            <p className="text-xs text-muted-foreground mt-0.5">ou clique para selecionar</p>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Password Field ───────────────────────────────────────────────────────────

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggleShow: () => void;
  placeholder?: string;
}

const PasswordField = ({ id, label, value, show, onChange, onToggleShow, placeholder }: PasswordFieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Digite a senha..."}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PdfTool = () => {
  const [addState, setAddState] = useState<TabState>(defaultTabState());
  const [removeState, setRemoveState] = useState<TabState>(defaultTabState());

  const updateAdd = (patch: Partial<TabState>) => setAddState((s) => ({ ...s, ...patch }));
  const updateRemove = (patch: Partial<TabState>) => setRemoveState((s) => ({ ...s, ...patch }));

  // ── Add Password ────────────────────────────────────────────────────────────

  const handleAddPassword = async () => {
    const { file, password, confirmPassword } = addState;

    if (!file) return updateAdd({ status: "error", errorMsg: "Selecione um arquivo PDF." });
    if (!password) return updateAdd({ status: "error", errorMsg: "Digite uma senha." });
    if (password !== confirmPassword) return updateAdd({ status: "error", errorMsg: "As senhas não coincidem." });
    if (password.length < 4) return updateAdd({ status: "error", errorMsg: "A senha deve ter pelo menos 4 caracteres." });

    updateAdd({ status: "processing", errorMsg: "", downloadUrl: "" });

    try {
      const { PDFDocument } = await import("pdf-lib-with-encrypt");
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      await pdfDoc.encrypt({
        userPassword: password,
        ownerPassword: password,
        permissions: {
          printing: "highResolution",
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: true,
          documentAssembly: false,
        },
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = file.name.replace(/\.pdf$/i, "") + "_protegido.pdf";

      updateAdd({ status: "done", downloadUrl: url, downloadName: name });
    } catch (err) {
      console.error(err);
      updateAdd({ status: "error", errorMsg: "Erro ao proteger o PDF. O arquivo pode estar corrompido." });
    }
  };

  // ── Remove Password ─────────────────────────────────────────────────────────

  const handleRemovePassword = async () => {
    const { file, password } = removeState;

    if (!file) return updateRemove({ status: "error", errorMsg: "Selecione um arquivo PDF protegido." });
    if (!password) return updateRemove({ status: "error", errorMsg: "Digite a senha atual do PDF." });

    updateRemove({ status: "processing", errorMsg: "", downloadUrl: "" });

    try {
      const { PDFDocument } = await import("pdf-lib-with-encrypt");
      const arrayBuffer = await file.arrayBuffer();

      let pdfDoc;
      try {
        pdfDoc = await PDFDocument.load(arrayBuffer, { password });
      } catch {
        return updateRemove({ status: "error", errorMsg: "Senha incorreta. Verifique e tente novamente." });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = file.name.replace(/\.pdf$/i, "") + "_sem_senha.pdf";

      updateRemove({ status: "done", downloadUrl: url, downloadName: name });
    } catch (err) {
      console.error(err);
      updateRemove({ status: "error", errorMsg: "Erro ao remover a proteção. Tente novamente." });
    }
  };

  // ── Download helper ─────────────────────────────────────────────────────────

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderFeedback = (state: TabState) => {
    if (state.status === "processing") {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Processando PDF...
        </div>
      );
    }
    if (state.status === "error") {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.errorMsg}
        </div>
      );
    }
    if (state.status === "done") {
      return (
        <div className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          PDF pronto para download!
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Seus arquivos são processados localmente e <strong>nunca saem do seu computador</strong>.
      </p>

      <Tabs defaultValue="add">
        <TabsList className="w-full">
          <TabsTrigger value="add" className="flex-1 gap-2">
            <Lock className="w-4 h-4" />
            Adicionar Senha
          </TabsTrigger>
          <TabsTrigger value="remove" className="flex-1 gap-2">
            <Unlock className="w-4 h-4" />
            Remover Senha
          </TabsTrigger>
        </TabsList>

        {/* ── Add Password Tab ── */}
        <TabsContent value="add" className="space-y-4 mt-4">
          <UploadArea
            file={addState.file}
            onFile={(f) => updateAdd({ file: f, status: "idle", downloadUrl: "", errorMsg: "" })}
          />

          <PasswordField
            id="add-password"
            label="Nova senha"
            value={addState.password}
            show={addState.showPassword}
            onChange={(v) => updateAdd({ password: v })}
            onToggleShow={() => updateAdd({ showPassword: !addState.showPassword })}
            placeholder="Crie uma senha segura..."
          />

          <PasswordField
            id="add-confirm"
            label="Confirmar senha"
            value={addState.confirmPassword}
            show={addState.showConfirm}
            onChange={(v) => updateAdd({ confirmPassword: v })}
            onToggleShow={() => updateAdd({ showConfirm: !addState.showConfirm })}
            placeholder="Repita a senha..."
          />

          {renderFeedback(addState)}

          <div className="flex gap-2">
            <Button
              onClick={handleAddPassword}
              disabled={addState.status === "processing"}
              className="flex-1"
            >
              <Lock className="w-4 h-4" />
              Proteger PDF
            </Button>

            {addState.status === "done" && addState.downloadUrl && (
              <Button
                variant="outline"
                onClick={() => triggerDownload(addState.downloadUrl, addState.downloadName)}
                className="flex-1"
              >
                <Download className="w-4 h-4" />
                Baixar PDF Protegido
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ── Remove Password Tab ── */}
        <TabsContent value="remove" className="space-y-4 mt-4">
          <UploadArea
            file={removeState.file}
            onFile={(f) => updateRemove({ file: f, status: "idle", downloadUrl: "", errorMsg: "" })}
          />

          <PasswordField
            id="remove-password"
            label="Senha atual do PDF"
            value={removeState.password}
            show={removeState.showPassword}
            onChange={(v) => updateRemove({ password: v })}
            onToggleShow={() => updateRemove({ showPassword: !removeState.showPassword })}
            placeholder="Digite a senha do PDF..."
          />

          {renderFeedback(removeState)}

          <div className="flex gap-2">
            <Button
              onClick={handleRemovePassword}
              disabled={removeState.status === "processing"}
              className="flex-1"
            >
              <Unlock className="w-4 h-4" />
              Remover Proteção
            </Button>

            {removeState.status === "done" && removeState.downloadUrl && (
              <Button
                variant="outline"
                onClick={() => triggerDownload(removeState.downloadUrl, removeState.downloadName)}
                className="flex-1"
              >
                <Download className="w-4 h-4" />
                Baixar PDF sem Senha
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PdfTool;
